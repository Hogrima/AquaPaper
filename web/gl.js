export function createProgram(gl, vertexSource, fragmentSource) {
  const shaders = [];
  const p = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const s = gl.createShader(type); shaders.push(s);
      gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  } catch (error) { gl.deleteProgram(p); throw error; }
  finally { for (const s of shaders) gl.deleteShader(s); }
}
