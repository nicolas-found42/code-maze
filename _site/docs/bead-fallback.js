// Standalone bead-maze fallback. Runs even if Three.js or WebGL fails to load.
(function () {
  function draw() {
    var container = document.getElementById("scene");
    if (!container || container.querySelector("canvas")) return;
    var W = container.clientWidth || 900;
    var H = container.clientHeight || 560;
    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement("canvas");
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.display = "block";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    var cx = W / 2;
    var cy = H * 0.62;
    var proj = function (x, y, z) {
      return [cx + (x - z) * 0.59, cy + (x + z) * 0.28 - y * 0.85];
    };

    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#f4ecdb");
    bg.addColorStop(1, "#d9cdb4");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    var c = [
      [-390, 250],
      [390, 250],
      [390, -250],
      [-390, -250],
    ].map(function (p) {
      return proj(p[0], 0, p[1]);
    });
    var top = c.map(function (p) {
      return [p[0], p[1] - 24];
    });
    [
      [0, 1],
      [1, 2],
    ].forEach(function (e) {
      var i = e[0];
      var j = e[1];
      ctx.beginPath();
      ctx.moveTo(top[i][0], top[i][1]);
      ctx.lineTo(top[j][0], top[j][1]);
      ctx.lineTo(c[j][0], c[j][1]);
      ctx.lineTo(c[i][0], c[i][1]);
      ctx.closePath();
      ctx.fillStyle = "#8a6438";
      ctx.fill();
    });
    ctx.beginPath();
    top.forEach(function (p, i) {
      return i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.closePath();
    var wood = ctx.createLinearGradient(0, 0, W, H);
    wood.addColorStop(0, "#e0bc8a");
    wood.addColorStop(1, "#b9895a");
    ctx.fillStyle = wood;
    ctx.fill();

    var beads = [
      ["#e24a3b", -120, 90, 40],
      ["#e24a3b", -250, 30, -100],
      ["#e24a3b", -330, 25, -60],
      ["#e24a3b", -40, 25, 40],
      ["#2f6fd6", 200, 50, -120],
      ["#2f6fd6", 290, 35, -40],
      ["#2f6fd6", 140, 30, -180],
      ["#2f6fd6", 250, 25, 80],
      ["#3fa34d", -180, 20, 170],
      ["#3fa34d", -280, 22, 140],
      ["#3fa34d", -100, 18, 120],
      ["#f0b429", 160, 22, 160],
      ["#f0b429", 280, 20, 120],
      ["#f0b429", 100, 18, 200],
      ["#7a4cc2", 0, 60, 0],
    ];

    // wires
    var wires = [
      [0, 1],
      [1, 2],
      [0, 3],
      [4, 5],
      [4, 6],
      [4, 7],
      [8, 9],
      [8, 10],
      [11, 12],
      [11, 13],
    ];
    wires.forEach(function (w) {
      var a = beads[w[0]];
      var b = beads[w[1]];
      var m = [(a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 55, (a[3] + b[3]) / 2];
      var p0 = proj(a[1], a[2], a[3]);
      var pm = proj(m[0], m[1], m[2]);
      var p1 = proj(b[1], b[2], b[3]);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo(pm[0], pm[1], p1[0], p1[1]);
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = a[0];
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.stroke();
    });

    // beads
    beads.forEach(function (b, i) {
      var p = proj(b[1], b[2], b[3]);
      var x = p[0];
      var y = p[1];
      var r = 14;
      ctx.beginPath();
      ctx.arc(x, y + 7, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = b[0];
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 4, y - 5, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fill();
      if (i % 3 === 1) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fill();
      }
    });

    container.appendChild(canvas);
  }

  function schedule() {
    setTimeout(draw, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }
})();
