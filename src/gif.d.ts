/// <reference types="vite/client" />

declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    workerScript?: string;
    width?: number;
    height?: number;
    background?: string;
  }
  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
  }
  export default class GIF {
    constructor(options?: GIFOptions);
    addFrame(
      image: HTMLCanvasElement | HTMLImageElement | CanvasRenderingContext2D | ImageData,
      options?: AddFrameOptions,
    ): void;
    on(event: 'finished', cb: (blob: Blob) => void): void;
    on(event: 'progress', cb: (p: number) => void): void;
    render(): void;
    abort(): void;
  }
}

declare module 'gif.js/dist/gif.worker.js?url' {
  const url: string;
  export default url;
}
