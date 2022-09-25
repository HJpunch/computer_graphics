"use strict";

var canvas;
var gl;

var points = [];

var NumTimesToSubdivide = 5;

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }

  // 첫 사각형 네 점 지정
  var vertices = [vec2(-1, 1), vec2(1, 1), vec2(-1, -1), vec2(1, -1)];

  divideRectangle(
    vertices[0],
    vertices[1],
    vertices[2],
    vertices[3],
    NumTimesToSubdivide
  );

  // configure webgl
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);

  // load shader, initialize attribute buffer
  var program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // load data into GPU
  var bufferId = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

  var vPosition = gl.getAttribLocation(program, "vPosition");
  gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  render();
};

function rectangle(a, b, c, d) {
  points.push(a, b, c, b, c, d);
  //   points.push(a, b, c, d);
}

// function triangle(a, b, c) {
//   points.push(a, b, c);
// }

function divideRectangle(a, b, c, d, count) {
  if (count === 0) {
    rectangle(a, b, c, d);
  } else {
    var aab = mix(a, b, 0.33); // a,b의 삼등분점
    var abb = mix(b, a, 0.33);
    var aac = mix(a, c, 0.33);
    var acc = mix(c, a, 0.33);
    var ccd = mix(c, d, 0.33);
    var cdd = mix(d, c, 0.33);
    var bbd = mix(b, d, 0.33);
    var bdd = mix(d, b, 0.33);

    --count;

    var top_left = vec2(aab[0], aac[1]);
    var top_right = vec2(abb[0], bbd[1]);
    var bottom_left = vec2(ccd[0], acc[1]);
    var bottom_right = vec2(cdd[0], bdd[1]);

    divideRectangle(a, aab, aac, top_left, count);
    divideRectangle(aab, abb, top_left, top_right, count);
    divideRectangle(abb, b, top_right, bbd, count);
    divideRectangle(aac, top_left, acc, bottom_left, count);
    divideRectangle(acc, bottom_left, c, ccd, count);
    divideRectangle(bottom_left, bottom_right, ccd, cdd, count);
    divideRectangle(bottom_right, bdd, cdd, d, count);
    divideRectangle(top_right, bbd, bottom_right, bdd, count);
  }
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, points.length);
}
