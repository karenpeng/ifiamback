const regl = require('regl')({
  extensions: ['OES_texture_float', 'OES_texture_float_linear']
})

const N = 512
const T = 2

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

function swap(tick) {
  const tmp = stateFBO[tick % T]
  stateFBO[(tick - 1) % T] = stateFBO[tick % T]
  stateFBO[tick % T] = tmp
}

function init () {
  const initFBO = regl(Object.assign({
    vert: `
      precision mediump float;
      attribute vec2 position;
      varying vec2 uv;
      void main() {
        uv = position;
        gl_Position = vec4(position, 1, 1);
      }
    `,
    frag: `
      precision mediump float;
      varying vec2 uv;
      void main() {
        vec2  p = (uv - 0.5) * 2.0;
        float d = 1.0 - dot(p, p);

        gl_FragColor = vec4(d * vec3(0.15, 0.2, 0.25), 1);
      }
    `,

    framebuffer: regl.prop('framebuffer'),

    attributes: {
      position: (() => {
        const result = []
        for (let i = 0; i < N; ++i) {
          for (let j = 0; j < N; ++j) {
            result.push([
              i / N,
              j / N
            ])
          }
        }
        return result
      })()
    },

    count: N * N,

    primitive: 'points'
  }))

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


init()

regl.frame(({tick}) => {
  init()
  swap(tick)
  update()
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
})
