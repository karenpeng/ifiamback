const regl = require('regl')({
  extensions: ['OES_texture_float', 'OES_texture_float_linear']
})
const camera = require('regl-camera')(regl, {
  distance: 5
})

const N = 512
const T = 2

const stateFBO = Array(T).fill().map(() =>
  regl.framebuffer({
    depthStencil: false,
    color: regl.texture({
      radius: N,
      type: 'float',
      min: 'linear',
      mag: 'linear',
      wrap: 'repeat'
    })
  }))

function nextFBO ({tick}) {
  return stateFBO[tick % T]
}

function prevFBO (n) {
  return ({tick}) => stateFBO[(tick + T - n) % T]
}

const bigTriangle = {
  vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 uv;
  void main () {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }
  `,

  attributes: {
    position: [
      [-4, 0],
      [4, 4],
      [4, -4]
    ]
  },

  count: 3
}

function init () {
  const initFBO = regl(Object.assign({
    frag: `
    precision mediump float;
    varying vec2 uv;
    void main () {
      float s = 1.0 / (1.0 + exp(-10.0 * (0.125 - length(uv - 0.5))));
      gl_FragColor = vec4(s, s, s, 1);
    }
    `,

    framebuffer: regl.prop('framebuffer')
  }, bigTriangle))

  for (let i = 0; i < T; ++i) {
    initFBO({
      framebuffer: stateFBO[i]
    })
  }
}


const update = regl(Object.assign({
  framebuffer: nextFBO,

  uniforms: {
    data: prevFBO(1),
    resolution: ({viewportWidth, viewportHeight}) =>
      [viewportWidth, viewportHeight],
    time: ({tick}) => tick
  },

  frag: `
  precision mediump float;

  #define PI 3.14159265359

  uniform sampler2D data;
  uniform float time;
  varying vec2 uv;


  void main() {
    vec4 tData    = texture2D(data, uv);
    vec2 position = tData.rg;
    vec2 speed    = tData.ba;

    speed.x += sin(position.x * 2.125 + uv.x + time) * 0.000225;
    speed.y += cos(position.y * 2.125 + uv.y + time)* 0.000225;

    float r = length(position);
    float a;

    if (r > 0.001) {
      a = atan(position.y, position.x);
    } else {
      a = 0.0;
    }

    position.x += cos(a + PI * 0.5) * 0.005;
    position.y += sin(a + PI * 0.5) * 0.005;

    position += speed;
    speed *= 0.975;
    position *= 0.995;

    gl_FragColor = vec4(position, speed);
  }
  `
}, bigTriangle))

const drawPoints = regl({
  vert: `
  precision mediump float;

  uniform sampler2D data;

  uniform vec2 resolution;
  attribute vec2 uv;

  void main() {
    vec4 tData = texture2D(data, uv);
    vec2 position = tData.rg;

    position.x *= resolution.y / resolution.x;

    gl_PointSize = 4.0;
    gl_Position = vec4(position, 1, 1);
  }
  `,

  frag: `
  precision mediump float;

  void main () {
    vec2  p = (gl_PointCoord.xy - 0.5) * 2.0;
    float d = 1.0 - dot(p, p);

    gl_FragColor = vec4(d * vec3(0.15, 0.2, 0.25), 1);
  }
  `,

  attributes: {
    uv: (() => {
      const result = []
      for (let i = 0; i < N; ++i) {
        for (let j = 0; j < N; ++j) {
          result.push([
            (i + 0.5) / N,
            (j + 0.5) / N
          ])
        }
      }
      return result
    })()
  },

  uniforms: {
    data: nextFBO,
    resolution: ({viewportWidth, viewportHeight}) =>
      [viewportWidth, viewportHeight],
    time: ({tick}) => tick
  },

  count: N * N,

  primitive: 'points'
})


init()

regl.frame(() => {
  update()


  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
  //camera(() => {
  drawPoints()
  //})
})
