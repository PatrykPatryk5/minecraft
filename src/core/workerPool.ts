import * as Comlink from 'comlink';
import type { TerrainWorker } from './generation.worker';

type WorkerCallback = (data: any) => void;

export let globalPool: WorkerPool | null = null;
export const getWorkerPool = () => globalPool;

export class WorkerPool {
    private rawWorkers: Worker[] = [];
    private workers: Comlink.Remote<TerrainWorker>[] = [];
    private pending: Set<string> = new Set();
    private nextWorkerIdx = 0;
    private ready = false;
    private taskQueue: { id: string; type: 'gen' | 'mesh'; args: any[]; resolve: WorkerCallback }[] = [];
    private meshWaiters: Map<string, WorkerCallback[]> = new Map();
    private activeTasks = 0;
    private maxConcurrent: number;
    private poolSize: number;

    constructor(
        private workerConstructor: new () => Worker,
        poolSize: number = 4,
        maxConcurrent?: number
    ) {
        // Safe cap for workers
        this.poolSize = Math.min(poolSize, 8);
        this.maxConcurrent = maxConcurrent ?? (this.poolSize * 2);
    }

    /** Initialize pool and seed all workers */
    init(seed: number): boolean {
        try {
            for (let i = 0; i < this.poolSize; i++) {
                const worker = new this.workerConstructor();
                const proxy = Comlink.wrap<TerrainWorker>(worker);

                // Initialize the worker's RNG
                proxy.initSeed(seed);

                this.rawWorkers.push(worker);
                this.workers.push(proxy);
            }

            this.ready = true;
            console.log(`[WorkerPool] ${this.poolSize} workers initialized (maxConcurrent: ${this.maxConcurrent})`);
            globalPool = this;
            return true;
        } catch (err) {
            console.warn('[WorkerPool] Failed to create workers:', err);
            this.ready = false;
            return false;
        }
    }

    /** Initialize UVs for all workers */
    async initUVs(uvs: Record<string, any>) {
        if (!this.ready) return;
        await Promise.all(this.workers.map(w => w.initUVs(uvs)));
        console.log('[WorkerPool] UVs synchronized');
    }

    isReady(): boolean {
        return this.ready;
    }

    /** Submit a chunk generation task */
    submit(cx: number, cz: number, dimension: string, callback: WorkerCallback): void {
        const id = `gen:${cx},${cz}:${dimension}`;
        if (this.pending.has(id) || this.taskQueue.some((t) => t.id === id)) return;

        this.taskQueue.push({ id, type: 'gen', args: [cx, cz, dimension], resolve: callback });
        this.processQueue();
    }

    /** Submit a meshing task */
    async submitMesh(cx: number, cz: number, chunkData: Uint16Array, neighbors: (Uint16Array | null)[], lod: number): Promise<any> {
        if (!this.ready) return null;
        const id = `mesh:${cx},${cz}:${lod}`;

        return new Promise((resolve) => {
            const waiters = this.meshWaiters.get(id) ?? [];
            waiters.push((data: any) => resolve(data));
            this.meshWaiters.set(id, waiters);

            // One active/queued mesh task per chunk+lod; newer callers wait for the same result.
            if (!this.pending.has(id) && !this.taskQueue.some((t) => t.id === id)) {
                this.taskQueue.push({
                    id,
                    type: 'mesh',
                    args: [cx, cz, chunkData, neighbors, lod],
                    resolve: (data: any) => this.resolveMeshWaiters(id, data),
                });
            }

            this.processQueue();
        });
    }

    private resolveMeshWaiters(id: string, data: any) {
        const waiters = this.meshWaiters.get(id);
        if (!waiters || waiters.length === 0) return;
        for (const waiter of waiters) waiter(data);
        this.meshWaiters.delete(id);
    }

    private takeNextTask() {
        if (this.taskQueue.length === 0) return null;
        // Keep generation responsive even under heavy meshing load.
        const genIndex = this.taskQueue.findIndex((task) => task.type === 'gen');
        if (genIndex >= 0) return this.taskQueue.splice(genIndex, 1)[0];
        return this.taskQueue.shift()!;
    }

    private async processQueue() {
        if (!this.ready || this.activeTasks >= this.maxConcurrent || this.taskQueue.length === 0) return;

        // Start as many tasks as possible up to maxConcurrent
        while (this.activeTasks < this.maxConcurrent && this.taskQueue.length > 0) {
            const task = this.takeNextTask();
            if (!task) break;

            if (task.type === 'gen' && this.pending.has(task.id)) {
                // Redundant generation task
                continue;
            }

            this.activeTasks++;
            this.pending.add(task.id);
            this.dispatch(task);
        }
    }

    private async dispatch(task: { id: string; type: 'gen' | 'mesh'; args: any[]; resolve: WorkerCallback }) {
        const workerIdx = this.nextWorkerIdx % this.workers.length;
        this.nextWorkerIdx++;
        const worker = this.workers[workerIdx];

        try {
            const workerPromise = task.type === 'gen'
                ? worker.generate(task.args[0], task.args[1], task.args[2])
                : worker.mesh(task.args[0], task.args[1], task.args[2], task.args[3], task.args[4]);

            // timeout to prevent zombie tasks
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error(`Worker timeout [${task.id}]`)), 15000)
            );

            const result = await Promise.race([workerPromise, timeoutPromise]);

            if (task.type === 'gen') {
                task.resolve({ cx: task.args[0], cz: task.args[1], id: task.id, data: result, dimension: task.args[2] });
            } else {
                task.resolve(result);
            }
        } catch (e) {
            console.error(`[WorkerPool] Task ${task.id} failed:`, e);
            task.resolve(null);
        } finally {
            this.activeTasks--;
            this.pending.delete(task.id);
            this.processQueue();
        }
    }

    getActiveCount(): number {
        return this.activeTasks;
    }

    getQueueLength(): number {
        return this.taskQueue.length;
    }

    clearQueue(): void {
        this.taskQueue.length = 0;
        // Do not clear `pending`/`activeTasks`: running tasks cannot be cancelled safely.
        // Resolve queued waiters now so callers can recover quickly.
        for (const [id, waiters] of this.meshWaiters) {
            if (!this.pending.has(id)) {
                for (const waiter of waiters) waiter(null);
                this.meshWaiters.delete(id);
            }
        }
    }

    terminate(): void {
        for (const w of this.rawWorkers) w.terminate();
        this.rawWorkers = [];
        this.workers = [];
        for (const waiters of this.meshWaiters.values()) {
            for (const waiter of waiters) waiter(null);
        }
        this.meshWaiters.clear();
        this.pending.clear();
        this.taskQueue = [];
        this.activeTasks = 0;
        this.ready = false;
        if (globalPool === this) globalPool = null;
    }
}
