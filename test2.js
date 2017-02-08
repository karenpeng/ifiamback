const regl = require('regl')({
  extensions: ['OES_texture_float', 'OES_texture_float_linear']
})

let initVert = {
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

let initFrag = {
  frag: `
    precision mediump float;
    varying vec2 uv;
    void main () {
      float s = 1.0 / (1.0 + exp(-10.0 * (0.125 - length(uv - 0.5))));
      gl_FragColor = vec4(s, s, s, 1);
    }
  `,
  framebuffer: regl.prop('framebuffer')
}

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

const nextFBO = ({tick}) => {
  return stateFBO[tick % T]
}

const prevFBO = (n) => {
  return ({tick}) => stateFBO[(tick + T - n) % T]
}

const init = () => {
  const initFBO = regl(Object.assign(
    {},
    initFrag,
    initVert
  ))

  for(let i = 0; i < T; ++i) {
    initFBO({
      framebuffer: stateFBO[i]
    })
  }
}

const update = regl(Object.assign({
  framebuffer: nextFBO,
  uniforms: {
    state: prevFBO(0),
    resolution: ({viewportWidth, viewportHeight}) =>
      [viewportWidth, viewportHeight],
    time: ({tick}) => tick * 0.001
  },
  frag: `
    precision mediump float;

    uniform sampler2D state;
    uniform float time;
    //uniform vec2 resolution;
    varying vec2 uv;

    // looks like below wont work
    //#pragma glslify: noise = require('glsl-noise/simplex/3d')

    void main() {
      // // vec2 uv       = gl_FragCoord.xy / resolution;
      vec4 tData    = texture2D(state, uv);
      vec2 position = tData.rg;
      vec2 speed    = tData.ba;

      speed.x += sin(position.x * 2.125 + uv.x + time) * 0.0005;
      speed.y += cos(position.y * 2.125 + uv.y + time + 1000.0) * 0.0005;

      position += speed;
      speed *= 0.975;
      position *= 0.995;

      gl_FragColor = vec4(position, speed);
      gl_FragColor = vec4(position, speed);
    }
  `},
  initVert
))

init()

regl.frame(() => {

  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })

  update()
})
