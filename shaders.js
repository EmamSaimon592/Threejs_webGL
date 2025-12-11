export const simulationVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const simulationFragmentShader = `
  uniform sampler2D textureA;    // Previous state: (pressure, velocity, gradX, gradY)
  uniform vec2 mouse;
  uniform vec2 resolution;
  uniform float time;
  uniform int frame;

  varying vec2 vUv;

  const float delta = 1.4;       // Wave speed factor
  const float damping = 0.998;   // Energy dissipation
  const float velocityDamping = 0.995;

  void main() {
    vec2 uv = vUv;
    vec2 texelSize = 1.0 / resolution;

    if (frame == 0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    vec4 data = texture2D(textureA, uv);
    float pressure = data.x;
    float pVel = data.y;

    // Sample neighboring pressures
    float p_right = texture2D(textureA, uv + vec2(texelSize.x, 0.0)).x;
    float p_left  = texture2D(textureA, uv + vec2(-texelSize.x, 0.0)).x;
    float p_up    = texture2D(textureA, uv + vec2(0.0, texelSize.y)).x;
    float p_down  = texture2D(textureA, uv + vec2(0.0, -texelSize.y)).x;

    // Boundary reflection (Neumann conditions)
    if (uv.x <= texelSize.x) p_left = p_right;
    if (uv.x >= 1.0 - texelSize.x) p_right = p_left;
    if (uv.y <= texelSize.y) p_down = p_up;
    if (uv.y >= 1.0 - texelSize.y) p_up = p_down;

    // Wave equation acceleration (Laplacian approximation)
    float laplacian = (p_right + p_left + p_up + p_down - 4.0 * pressure);
    pVel += delta * laplacian;

    // Update pressure from velocity
    pressure += delta * pVel;

    // Damping
    pVel *= velocityDamping;
    pressure *= damping;

    // Mouse interaction
    if (mouse.x > 0.0) {
      vec2 mouseUV = mouse / resolution;
      float dist = distance(uv, mouseUV);
      float radius = 0.02;
      if (dist < radius) {
        float strength = 3.0 * (1.0 - dist / radius);
        pressure += strength;
        pVel += strength * 0.5;
      }
    }

    // Compute gradients for normal mapping
    float gradX = (p_right - p_left) * 0.5;
    float gradY = (p_up - p_down) * 0.5;

    gl_FragColor = vec4(pressure, pVel, gradX, gradY);
  }
`;

export const renderVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const renderFragmentShader = `
  uniform sampler2D textureA;  // Simulation state
  uniform sampler2D textureB;  // Background texture (e.g. water/caustics/image)

  varying vec2 vUv;

  void main() {
    vec4 data = texture2D(textureA, vUv);
    float pressure = data.x;
    vec2 gradient = data.zw;

    // Refraction distortion
    vec2 distortion = gradient * 0.03;  // Adjust strength
    vec4 color = texture2D(textureB, vUv + distortion);

    // Normal from height gradients
    vec3 normal = normalize(vec3(-gradient.x * 8.0, 1.0, -gradient.y * 8.0));

    // Simple directional light
    vec3 lightDir = normalize(vec3(-1.0, 2.0, -1.0));
    float diffuse = max(dot(normal, lightDir), 0.0);
    float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, -1.0)), 0.0), 128.0);

    // Combine
    vec3 finalColor = color.rgb * (diffuse * 0.8 + 0.4) + vec3(specular * 1.2);

    // Optional: tint for water look
    finalColor = mix(finalColor, vec3(0.0, 0.3, 0.6), 0.15);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
