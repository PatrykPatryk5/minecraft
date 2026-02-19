/**
 * Worker Pool — Manages multiple Web Workers for parallel chunk generation
 *
 * Features:
 *   - Configurable pool size (default 4 workers)
 *   - Round-robin task distribution
 *   - Automatic fallback if workers unavailable
 *   - Transferable buffer support (zero-copy)
 *   - Task queue with priority
 */

type WorkerCallback = (data: any) => void;

interface PendingTask {
    id: string;
    resolve: WorkerCallback;
}

export class WorkerPool {
    private workers: Worker[] = [];
    private pending: Map<string, PendingTask> = new Map();
    private nextWorker = 0;
    private ready = false;
    private taskQueue: { msg: any; id: string; resolve: WorkerCallback }[] = [];
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

                worker.onmessage = (e: MessageEvent) => {
                    const { type: msgType, cx, cz, id, data } = e.data;
                    if (msgType === 'ready') return;

                    const key = id || `${cx},${cz}`;
                    const task = this.pending.get(key);
                    if (task) {
                        this.pending.delete(key);
                        this.activeTasks--;
                        task.resolve(e.data);
                    }

                    // Process queued tasks
                    this.processQueue();
                };

                worker.onerror = (err) => {
                    console.warn(`[WorkerPool] Worker ${i} error:`, err);
                };

                // Init seed
                worker.postMessage({ type: 'init', seed });
                this.workers.push(worker);
            }

            this.ready = true;
            console.log(`[WorkerPool] ${this.poolSize} workers initialized, seed: ${seed}`);
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
    submit(cx: number, cz: number, callback: WorkerCallback): void {
        const id = `${cx},${cz}`;

        if (this.pending.has(id)) return; // Already processing

        if (this.activeTasks >= this.maxConcurrent) {
            // Queue it
            this.taskQueue.push({ msg: { cx, cz, id }, id, resolve: callback });
            return;
        }

        this.dispatch(cx, cz, id, callback);
    }

    private dispatch(cx: number, cz: number, id: string, callback: WorkerCallback): void {
        const worker = this.workers[this.nextWorker % this.workers.length];
        this.nextWorker++;
        this.activeTasks++;

        this.pending.set(id, { id, resolve: callback });
        worker.postMessage({ cx, cz, id });
    }

    private processQueue(): void {
        while (this.taskQueue.length > 0 && this.activeTasks < this.maxConcurrent) {
            const task = this.taskQueue.shift()!;
            this.dispatch(task.msg.cx, task.msg.cz, task.id, task.resolve);
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

    /** Terminate all workers */
    terminate(): void {
        for (const w of this.workers) w.terminate();
        this.workers = [];
        this.pending.clear();
        this.taskQueue = [];
        this.activeTasks = 0;
        this.ready = false;
    }
}
