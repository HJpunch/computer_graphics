"use strict";

var canvas;
var gl;
var program;

var maxNumVertices = 20000;
var index = 0; // 정점의 개수를 나타내는 인덱스.
var cindex = 0; // fragment shader에 넘길 색상 정보를 가리키는 인덱스

var colors = [
  vec4(0.0, 0.0, 0.0, 1.0), // black
  vec4(1.0, 0.0, 0.0, 1.0), // red
  vec4(1.0, 1.0, 0.0, 1.0), // yellow
  vec4(0.0, 1.0, 0.0, 1.0), // green
  vec4(0.0, 0.0, 1.0, 1.0), // blue
  vec4(1.0, 0.0, 1.0, 1.0), // magenta
  vec4(0.0, 1.0, 1.0, 1.0), // cyan
];

var redraw = false;

var coordinate1;
var coordinate2;
var boxCoordinate = {
  leftTop: null,
  rightTop: null,
  rightBottom: null,
  leftBottom: null,
};

var image_id = 0;
var fileName;
var imgWidth;
var imgHeight;
var objectArray = [0];
var object_id = 0;

var texture;
var background = 0; // 로드된 이미지가 있는 지를 나타내는 변수. 0일 시 마우스 이벤트가 발생하지 않음

var t;
var numPolygons = 0; // 현재까지 그려진 도형의 개수
var numIndices = [0]; // n번째 도형을 구성하는 정점의 개수
var start = [0]; // 정점 쉐이더로 전달되는 정점 배열에서 n번째 도형의 첫 정점이 위치한 인덱스를 가리키는 배열

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }

  //========================================================
  const fileInput = document.getElementById("fileUpload");

  const handleFiles = e => {
    const selectedFile = [...fileInput.files];
    const fileReader = new FileReader();

    fileReader.readAsDataURL(selectedFile[0]);

    fileReader.onloadend = event => {
      fileName = selectedFile[0].name;
      var img = new Image();
      img.src = event.target.result;
      img.onload = function () {
        imgWidth = img.width;
        imgHeight = img.height;

        canvas.width = String(imgWidth);
        canvas.height = String(imgHeight);
        gl = WebGLUtils.setupWebGL(canvas);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      canvas.style.cssText = "background: url(" + event.target.result + ")";
    };
    background = 1;
    clearCanvas();
  };

  fileInput.addEventListener("change", handleFiles);
  //========================================================
  // colormenu의 선택값으로 단편 쉐이더에 전달될 색상을 지정한다.
  var colormenu = document.getElementById("colormenu");
  colormenu.addEventListener("click", function () {
    cindex = colormenu.selectedIndex;
  });

  //  canvas 초기화. 정점공간에 넘겨지는 배열과 관련된 변수들을 모두 0으로 초기화한다.
  var clear = document.getElementById("clear");
  clear.addEventListener("click", function () {
    clearCanvas();
  });

  var undo = document.getElementById("undo");
  undo.addEventListener("click", function () {
    if (numPolygons) {
      var startPoint = start[numPolygons--]; // 최근 box의 정점배열 인덱스 위치 저장
      numIndices[numPolygons] = 0; // box 삭제를 위해 인덱스 정보 초기화
      start[numPolygons] = startPoint;
      object_id--;
    }
  });

  var save = document.getElementById("save");
  save.addEventListener("click", function () {
    var jsonData = {
      image_id: image_id++,
      image_filename: fileName,
      image_size: { width: imgWidth, height: imgHeight },
      Object: getLabelList(),
    };

    downdload(jsonData);
  });

  canvas.addEventListener("mousedown", function (event) {
    redraw = true;
    coordinate1 = vec2(event.offsetX, event.offsetY);
  });

  canvas.addEventListener("mouseup", function (event) {
    if (!background) return;
    redraw = false;

    // 사용자에게 객체 이름 입력 받기.
    var objectNameSet = prompt("Set Label Name");
    if (!objectNameSet) return;

    coordinate2 = vec2(event.offsetX, event.offsetY);
    // 두 좌표를 기반으로 bounding box 객체 생성
    var object = new LabeledObject(coordinate1, coordinate2);
    var clipCoords = object.clipArray(); // 클립 좌표계 좌표 저장
    objectArray[numPolygons] = object; // 객체 배열에 생성된 객체 삽입

    for (var i = 0; i < clipCoords.length; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
      var value = clipCoords[i]; // 정점버퍼에 클립 좌표계 좌표 전달
      gl.bufferSubData(gl.ARRAY_BUFFER, 8 * index, flatten(value));

      gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
      t = colors[cindex];
      gl.bufferSubData(gl.ARRAY_BUFFER, 16 * index, flatten(t));

      numIndices[numPolygons]++;
      index++;
    }

    // 생성된 boundingbox 객체의 이름과 id 설정.
    objectArray[numPolygons].setName(objectNameSet);
    objectArray[numPolygons].setId(object_id++);

    numPolygons++;
    numIndices[numPolygons] = 0;
    start[numPolygons] = index;
  });

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  initBkgnd();
  gl.clear(gl.COLOR_BUFFER_BIT);

  //
  //  Load shaders and initialize attribute buffers
  //
  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  var vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 8 * maxNumVertices, gl.STATIC_DRAW);

  var vPosition = gl.getAttribLocation(program, "vPosition");
  gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPosition);

  var cBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 16 * maxNumVertices, gl.STATIC_DRAW);

  var vColor = gl.getAttribLocation(program, "vColor");
  gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vColor);

  render();
};

function clearCanvas() {
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  initBkgnd();
  gl.clear(gl.COLOR_BUFFER_BIT);

  numPolygons = 0;
  index = 0;
  numIndices = [0];
  start = [0];

  object_id = 0;
}

function setCoordinate(coord1, coord2, box) {
  box.leftTop = vec2(coord1[0], coord1[1]);
  box.leftBottom = vec2(coord1[0], coord2[1]);
  box.rightTop = vec2(coord2[0], coord1[1]);
  box.rightBottom = vec2(coord2[0], coord2[1]);
}

// 윈도우 좌표계 좌표 객체
function LabeledObject(coord1, coord2) {
  // 클립 좌표계의 좌표로 변환
  var clipCoord1 = vec2(
    (2 * coord1[0]) / canvas.width - 1,
    (2 * (canvas.height - coord1[1])) / canvas.height - 1
  );

  var clipCoord2 = vec2(
    (2 * coord2[0]) / canvas.width - 1,
    (2 * (canvas.height - coord2[1])) / canvas.height - 1
  );

  this._id = null;
  this._name = null;

  this._leftTop = vec2(coord1[0], coord1[1]);
  this._rightTop = vec2(coord2[0], coord1[1]);
  this._rightBottom = vec2(coord2[0], coord2[1]);
  this._leftBottom = vec2(coord1[0], coord2[1]);

  // 클립좌표계 좌표 배열 반환
  this.clipArray = function () {
    return [
      clipCoord1,
      vec2(clipCoord2[0], clipCoord1[1]),
      clipCoord2,
      vec2(clipCoord1[0], clipCoord2[1]),
    ];
  };

  this.getId = function () {
    return this._id;
  };
  this.setId = function (Id) {
    this._id = Id;
  };

  this.getName = function () {
    return this._name;
  };
  this.setName = function (Name) {
    this._name = Name;
  };

  this.getCoordDict = function () {
    return { x1: coord1[0], y1: coord1[1], x2: coord2[0], y2: coord2[1] };
  };
}

function getLabelList() {
  var list = [];
  for (var i = 0; i < numPolygons; i++) {
    var obj = objectArray[i];
    var dict = {
      object_id: obj.getId(),
      object_name: obj.getName(),
      object_coord: obj.getCoordDict(),
    };
    list.push(dict);
  }
  return list;
}

function downdload(data) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "text/plain",
    })
  );
  a.setAttribute("download", fileName + ".json");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 텍스쳐 초기화
function initBkgnd() {
  texture = gl.createTexture();
  texture.Img = new Image();
  texture.Img.onload = function () {
    configureTexture(texture);
  };
}

function configureTexture(image) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.NEAREST_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);

  for (var i = 0; i <= numPolygons; i++) {
    gl.drawArrays(gl.LINE_LOOP, start[i], numIndices[i]);
  }

  window.requestAnimFrame(render);
}
