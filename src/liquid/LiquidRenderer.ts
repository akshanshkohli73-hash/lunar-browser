import { vertexShader, fragmentShader } from "./shaders";
import type { LiquidMaterial } from "./LiquidMaterial";
import type { AtlasTile, LiquidSettings, Rect } from "../../shared/liquid";
export type DrawSurface = {
  rect: Rect;
  scene: Rect;
  material: LiquidMaterial;
  bend: [number, number, number];
  pointer: [number, number];
  view?: boolean;
  shade: number;
  backgroundBlur: number;
  contain: boolean;
};
type TimerExtension = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
/** One program, quad, VAO, texture and drawing buffer for every DOM surface. */
export class LiquidRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly maxSize: number;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private vao: WebGLVertexArrayObject;
  private texture: WebGLTexture;
  private locations = new Map<string, WebGLUniformLocation | null>();
  private textureWidth = 0;
  private textureHeight = 0;
  private timer: TimerExtension | null;
  private query: WebGLQuery | null = null;
  gpuMs: number | null = null;
  uploads = 0;
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;
    this.maxSize = Math.min(
      4096,
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    );
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("shader-allocation");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`shader-compile: ${message?.slice(0, 180)}`);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexShader),
      fragment = compile(gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram();
    if (!program) throw new Error("program-allocation");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      throw new Error("shader-link");
    }
    this.program = program;
    const buffer = gl.createBuffer(),
      vao = gl.createVertexArray(),
      texture = gl.createTexture();
    if (!buffer || !vao || !texture) throw new Error("resource-allocation");
    this.buffer = buffer;
    this.vao = vao;
    this.texture = texture;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.timer = gl.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    ) as TimerExtension | null;
  }
  upload(source: TexImageSource, width: number, height: number) {
    const gl = this.gl;
    if (
      width > this.maxSize ||
      height > this.maxSize ||
      width * height > 16777216
    )
      throw new Error("texture-dimensions");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (width !== this.textureWidth || height !== this.textureHeight) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
      this.textureWidth = width;
      this.textureHeight = height;
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("texture-upload");
    this.uploads++;
  }
  private loc(name: string) {
    if (!this.locations.has(name))
      this.locations.set(name, this.gl.getUniformLocation(this.program, name));
    return this.locations.get(name)!;
  }
  render(
    width: number,
    height: number,
    tiles: AtlasTile[],
    surfaces: DrawSurface[],
    settings: LiquidSettings,
    samples: number,
  ) {
    const gl = this.gl;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (
      this.query &&
      gl.getQueryParameter(this.query, gl.QUERY_RESULT_AVAILABLE)
    ) {
      if (this.timer && !gl.getParameter(this.timer.GPU_DISJOINT_EXT))
        this.gpuMs = gl.getQueryParameter(this.query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(this.query);
      this.query = null;
    }
    let current: WebGLQuery | null = null;
    if (this.timer && !this.query) {
      current = gl.createQuery();
      if (current) gl.beginQuery(this.timer.TIME_ELAPSED_EXT, current);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.loc("uBackground"), 0);
    gl.uniform1f(this.loc("uSamples"), samples);
    gl.uniform1f(this.loc("uElasticity"), settings.elasticity);
    for (const tile of tiles) {
      const s = surfaces[tile.index],
        m = s.material;
      gl.viewport(
        tile.x,
        height - tile.y - tile.height,
        tile.width,
        tile.height,
      );
      gl.uniform4f(
        this.loc("uRect"),
        s.rect.x,
        s.rect.y,
        s.rect.width,
        s.rect.height,
      );
      gl.uniform4f(
        this.loc("uScene"),
        s.scene.x,
        s.scene.y,
        s.scene.width,
        s.scene.height,
      );
      gl.uniform4f(this.loc("uRadii"), ...m.radii);
      gl.uniform4f(
        this.loc("uMaterial"),
        m.opacity,
        m.blur,
        m.saturation,
        m.refraction,
      );
      gl.uniform4f(
        this.loc("uOptics"),
        settings.curvature,
        settings.edgeLensing,
        settings.specular,
        m.edge,
      );
      gl.uniform3f(this.loc("uTint"), ...m.tint);
      gl.uniform3f(this.loc("uDeform"), ...s.bend);
      gl.uniform2f(this.loc("uPointer"), ...s.pointer);
      gl.uniform1f(this.loc("uDark"), m.dark);
      gl.uniform1f(this.loc("uReflection"), m.reflection);
      gl.uniform1f(this.loc("uShade"), s.shade);
      gl.uniform1f(this.loc("uBackgroundBlur"), s.backgroundBlur);
      gl.uniform1f(this.loc("uView"), s.view ? 1 : 0);
      gl.uniform1f(this.loc("uContain"), s.contain ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (current && this.timer) {
      gl.endQuery(this.timer.TIME_ELAPSED_EXT);
      this.query = current;
    }
    if (gl.getError() !== gl.NO_ERROR) throw new Error("gpu-draw-unavailable");
  }
  dispose() {
    const gl = this.gl;
    if (this.query) gl.deleteQuery(this.query);
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
