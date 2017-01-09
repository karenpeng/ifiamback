const regl = require('regl')()
const mat4 = require('gl-mat4')
const box = require('./box')
const fit = require('canvas-fit')
const normals = require('angle-normals')
const canvas = document.body.appendChild(document.createElement('canvas'))
const camera = require('canvas-orbit-camera')(canvas)
window.addEventListener('resize', fit(canvas), false)

const drawBunny = regl({
  frag: `
    precision mediump float;
    varying vec3 vnormal;
    void main () {
      gl_FragColor = vec4(abs(vnormal), 1.0);
    }`,
  vert: `
    precision mediump float;
    uniform mat4 proj;
    uniform mat4 model;
    uniform mat4 view;
    attribute vec3 position;
    attribute vec3 normal;
    varying vec3 vnormal;
    uniform vec2 offset;
    void main () {
      vnormal = normal;
      vec3 newPosition = vec3(position.xy + offset * 4.0, position.z);
      gl_Position = proj * view * model * vec4(newPosition, 1.0);
    }`,
  attributes: {
    position: box.positions,
    normal: normals(box.elements, box.positions)
  },
  elements: box.elements,
  uniforms: {
    proj: ({viewportWidth, viewportHeight}) =>
      mat4.perspective([],
        Math.PI / 2,
        viewportWidth / viewportHeight,
        0.01,
        1000),
    model: mat4.identity([]),
    view: () => camera.view(),
    offset: regl.prop('offset')
  }
})

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1]
  })
  camera.tick()
  drawBunny(
    [
    { offset: [-1, -1] },
    { offset: [-1, 0] },
    { offset: [-1, 1] },
    { offset: [0, -1] },
    { offset: [0, 0] },
    { offset: [0, 1] },
    { offset: [1, -1] },
    { offset: [1, 0] },
    { offset: [1, 1] }
  ]
  )
})
