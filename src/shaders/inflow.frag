varying vec2 vUv;
uniform sampler2D uVelocity;
uniform float speed;

void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    
    // Force inflow at left boundary (x < 0.05)
    if (vUv.x < 0.02) {
        velocity = vec2(speed, 0.0);
    }
    
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
