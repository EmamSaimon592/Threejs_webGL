import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.168.0/build/three.module.js';
import {
  simulationVertexShader,
  simulationFragmentShader,
  renderVertexShader,
  renderFragmentShader,
} from './shaders.js'; // <-- don't forget the .js extension if using modules

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------
  // Basic Three.js setup
  // --------------------------------------------------------------
  const scene = new THREE.Scene();
  const simScene = new THREE.Scene();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // --------------------------------------------------------------
  // Mouse
  // --------------------------------------------------------------
  const mouse = new THREE.Vector2(0, 0);

  // --------------------------------------------------------------
  // Render targets (double-buffered simulation)
  // --------------------------------------------------------------
  const width = window.innerWidth * window.devicePixelRatio;
  const height = window.innerHeight * window.devicePixelRatio;

  const rtOptions = {
    format: THREE.RGBAFormat,
    type: THREE.FloatType, // HalfFloatType also works on most devices
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  };

  let rtA = new THREE.WebGLRenderTarget(width, height, rtOptions);
  let rtB = new THREE.WebGLRenderTarget(width, height, rtOptions);

  // --------------------------------------------------------------
  // Simulation material (simulation step)
  // --------------------------------------------------------------
  const simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      textureA: { value: null },
      mouse: { value: mouse },
      resolution: { value: new THREE.Vector2(width, height) },
      time: { value: 0 },
      frame: { value: 0 },
    },
    vertexShader: simulationVertexShader,
    fragmentShader: simulationFragmentShader,
  });

  // --------------------------------------------------------------
  // Render material (final compositing)
  // --------------------------------------------------------------
  const renderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      textureA: { value: null }, // simulation result
      textureB: { value: null }, // our static text texture
    },
    vertexShader: renderVertexShader,
    fragmentShader: renderFragmentShader,
    transparent: true,
    depthWrite: false,
  });

  // Full-screen quads
  const plane = new THREE.PlaneGeometry(2, 2);
  const simQuad = new THREE.Mesh(plane, simMaterial);
  const renderQuad = new THREE.Mesh(plane, renderMaterial);

  simScene.add(simQuad);
  scene.add(renderQuad);

  // --------------------------------------------------------------
  // Static canvas texture ("softhorizon")
  // --------------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  function updateTextTexture() {
    ctx.fillStyle = '#fb7427';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fontSize = Math.round(250 * window.devicePixelRatio);
    ctx.fillStyle = '#fef4b8';
    ctx.font = `bold ${fontSize}px "Test Söhne", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('softhorizon', canvas.width / 2, canvas.height / 2);
  }

  updateTextTexture();
  const textTexture = new THREE.CanvasTexture(canvas);
  textTexture.minFilter = THREE.LinearFilter;
  textTexture.magFilter = THREE.LinearFilter;

  // --------------------------------------------------------------
  // Resize handling
  // --------------------------------------------------------------
  window.addEventListener('resize', () => {
    const newWidth = window.innerWidth * window.devicePixelRatio;
    const newHeight = window.innerHeight * window.devicePixelRatio;

    renderer.setSize(window.innerWidth, window.innerHeight);

    rtA.setSize(newWidth, newHeight);
    rtB.setSize(newWidth, newHeight);

    simMaterial.uniforms.resolution.value.set(newWidth, newHeight);

    canvas.width = newWidth;
    canvas.height = newHeight;
    updateTextTexture();
    textTexture.needsUpdate = true;
  });

  // --------------------------------------------------------------
  // Mouse handling
  // --------------------------------------------------------------
  renderer.domElement.addEventListener('mousemove', e => {
    mouse.x = e.clientX * window.devicePixelRatio;
    mouse.y = (window.innerHeight - e.clientY) * window.devicePixelRatio;
  });

  renderer.domElement.addEventListener('mouseleave', () => {
    mouse.set(0, 0);
  });

  // --------------------------------------------------------------
  // Animation loop
  // --------------------------------------------------------------
  let frame = 0;

  const animate = () => {
    frame++;
    simMaterial.uniforms.frame.value = frame;
    simMaterial.uniforms.time.value = performance.now() / 1000;
    simMaterial.uniforms.textureA.value = rtA.texture;

    // ---- Simulation pass -------------------------------------------------
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, camera);

    // ---- Final render pass ------------------------------------------------
    renderMaterial.uniforms.textureA.value = rtB.texture; // current simulation state
    renderMaterial.uniforms.textureB.value = textTexture; // static text

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    // Swap buffers
    const temp = rtA;
    rtA = rtB;
    rtB = temp;

    requestAnimationFrame(animate);
  };

  animate();
});
