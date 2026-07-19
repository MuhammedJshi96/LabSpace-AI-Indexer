declare module "pngjs" {
  export class PNG {
    data: Buffer;
    width: number;
    height: number;
    static sync: {
      read(buffer: Buffer): PNG;
    };
  }
}
