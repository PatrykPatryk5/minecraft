import * as Comlink from 'comlink';
import type { TerrainWorker } from './generation.worker';

type WorkerCallback = (data: any) => void;

interface PendingTask {
    id: string;
    resolve: WorkerCallback;
}

export class WorkerPool {
    private rawWorkers: Worker[] = [];
    private workers: Comlink.Remote<TerrainWorker>[] = [];
    private pending: Map<string, PendingTask> = new Map();
    private nextWorker = 0;
    private ready = false;
    private taskQueue: { cx: number, cz: number, id: string; dimension: string; resolve: WorkerCallback }[] = [];
    private activeTasks = 0;
    private maxConcurrent: number;

    constructor(
        private workerUrl: URL,
        private poolSize: number = 4,
        maxConcurrent?: number
    ) {
        this.maxConcurrent = maxConcurrent ?? poolSize * 4;
    }

    /** Initialize pool and seed all workers */
    init(seed: number): boolean {
        try {
            for (let i = 0; i < this.poolSize; i++) {
                const worker = new Worker(this.workerUrl, { type: 'module' });
                const proxy = Comlink.wrap<TerrainWorker>(worker);

                // Initialize the worker's RNG
                proxy.initSeed(seed);

                this.rawWorkers.push(worker);
                this.workers.push(proxy);
            }

            this.ready = true;
            console.log(`[WorkerPool] ${this.poolSize} Comlink workers initialized, seed: ${seed}`);
            return true;
        } catch (err) {
            console.warn('[WorkerPool] Failed to create workers:', err);
            this.ready = false;
            return false;
        }
    }

    isReady(): boolean {
        return this.ready;
    }

    /** Submit a chunk generation task */
    submit(cx: number, cz: number, dimension: string, callback: WorkerCallback): void {
        const id = `${cx},${cz}`;

        if (this.pending.has(id)) return; // Already processing or queued

        this.pending.set(id, { id, resolve: callback });

        if (this.activeTasks >= this.maxConcurrent) {
            // Queue it
            this.taskQueue.push({ cx, cz, id, dimension, resolve: callback });
            return;
        }

        this.activeTasks++;
        this.dispatch(cx, cz, dimension, id, callback);
    }

    private async dispatch(cx: number, cz: number, dimension: string, id: string, callback: WorkerCallback) {
        const worker = this.workers[this.nextWorker % this.workers.length];
        this.nextWorker++;

        try {
            // Await the generation natively with a timeout safety to prevent permanent lockups
            const generatePromise = worker.generate(cx, cz, dimension);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Worker timeout')), 25000)
            );

            const data = await Promise.race([generatePromise, timeoutPromise]);

            // Re-check pending map in case the queue was cleared (e.g. dimension switch)
            const task = this.pending.get(id);
            if (task) {
                this.pending.delete(id);
                this.activeTasks--;
                task.resolve({ cx, cz, id, data, dimension });
            }
        } catch (e) {
            console.error('[WorkerPool] Generation error/timeout for chunk', id, e);
            this.activeTasks--;
            this.pending.delete(id);
        }

        // Process queued tasks
        this.processQueue();
    }

    private processQueue(): void {
        while (this.taskQueue.length > 0 && this.activeTasks < this.maxConcurrent) {
            const task = this.taskQueue.shift()!;
            // Only dispatch if still pending (might have been cleared)
            if (this.pending.has(task.id)) {
                this.activeTasks++;
                this.dispatch(task.cx, task.cz, task.dimension, task.id, task.resolve);
            }
        }
    }

    /** Get number of active tasks */
    getActiveCount(): number {
        return this.activeTasks;
    }

    /** Get queue length */
    getQueueLength(): number {
        return this.taskQueue.length;
    }

    /** Clear pending queue (useful when switching dimensions) */
    clearQueue(): void {
        this.taskQueue = [];
        this.pending.clear();
        this.activeTasks = 0; // The active promises will still resolve, but will be ignored due to pending map clear
    }

    /** Terminate all workers */
    terminate(): void {
        for (const w of this.rawWorkers) w.terminate();
        this.rawWorkers = [];
        this.workers = [];
        this.pending.clear();
        this.taskQueue = [];
        this.activeTasks = 0;
        this.ready = false;
    }
}
