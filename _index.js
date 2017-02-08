const regl = require('regl')({
  extensions: ['OES_texture_float', 'OES_texture_float_linear']
})
const camera = require('regl-camera')(regl, {
  distance: 5
})
const box = require('./box')
const mat4 = require('gl-mat4')

const N = 512
const T = 3

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

const update = regl(Object.assign({
  framebuffer: nextFBO,

  uniforms: {
    'state[0]': prevFBO(1),
    'state[1]': prevFBO(2),
    resolution: ({viewportWidth, viewportHeight}) =>
      [viewportWidth, viewportHeight],
    impulse: regl.prop('impulse'),
    weight: regl.prop('weight')
  },

  frag: `
  precision mediump float;
  uniform sampler2D state[2];
  uniform vec2 resolution;
  uniform vec2 impulse;
  uniform float weight;
  varying vec2 uv;
  vec4 fetch (sampler2D image, vec2 index) {
    return texture2D(image, index / resolution);
  }
  vec4 laplacian (sampler2D image, vec2 index) {
    return (
      fetch(image, index + vec2(1, 0)) +
      fetch(image, index + vec2(-1, 0)) +
      fetch(image, index + vec2(0, -1)) +
      fetch(image, index + vec2(0, 1)))
      - 4.0 * fetch(image, index);
  }
  void main () {
    vec2 index = uv * resolution;
    vec4 s0 = fetch(state[0], index);
    vec4 s1 = fetch(state[1], index);
    vec4 L = laplacian(state[0], index);
    float I = weight / (1.0 + exp(-1000.0 * (0.01 - distance(uv, impulse))));
    gl_FragColor = 0.99 * (s0 + (s0 - s1 + 0.5 * L) + I);
  }
  `
}, bigTriangle))

const drawImage = regl(Object.assign({
  frag: `
  precision mediump float;
  uniform sampler2D state[3];
  varying vec2 uv;
  void main () {
    float s0 = texture2D(state[0], uv).r;
    float s1 = texture2D(state[1], uv).g;
    float s2 = texture2D(state[2], uv).b;
    float lo = min(min(s0, s1), s2);
    float hi = max(max(s0, s1), s2);
    gl_FragColor = vec4(s0, s1, s2, 1);
  }
  `,

  uniforms: {
    'state[0]': prevFBO(0),
    'state[1]': prevFBO(1),
    'state[2]': prevFBO(2)
  },

  depth: {
    enable: false
  }
}, bigTriangle))

const drawPoints = regl({
  vert: `
  precision mediump float;
  attribute vec2 pointId;
  uniform sampler2D state;
  uniform mat4 projection, view;
  varying vec2 uv;
  void main () {
    vec4 position = texture2D(state, pointId);
    uv = pointId;
    gl_PointSize = 1.0;
    gl_Position = projection * view * vec4(
      pointId.x - 0.5,
      0.25 * position.r,
      pointId.y - 0.5,
      1);
  }
  `,

  frag: `
  precision mediump float;
  varying vec2 uv;
  void main () {
    gl_FragColor = vec4(uv.r, 1, uv.g, 1);
  }
  `,

  attributes: {
    pointId: (() => {
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
    state: nextFBO
  },

  count: N * N,

  primitive: 'points'
})

init()

regl.frame(() => {
  // update({
  //   impulse: [Math.random(), Math.random()],
  //   weight: Math.pow(Math.random(), 8.0)
  // })
  //drawImage()

  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
  camera(() => {
    //drawPoints()
    drawImage()
  })
})

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
