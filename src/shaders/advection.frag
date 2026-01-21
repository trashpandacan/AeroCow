varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;

void main() {
    // Semi-Lagrangian advection: trace back along velocity field
    // Velocity is stored in grid-units per second, scale to UV space
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    vec2 coord = vUv - velocity * texelSize * dt;

    // Clamp to valid texture coordinates
    coord = clamp(coord, vec2(0.0), vec2(1.0));

    vec4 result = texture2D(uSource, coord);

    // Dissipation: multiply to gently decay the field (1.0 = no decay)
    gl_FragColor = result * dissipation;
}
