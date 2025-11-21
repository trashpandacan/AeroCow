varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uObstacle;

void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    float obstacle = texture2D(uObstacle, vUv).r;
    
    if (obstacle > 0.1) {
        velocity = vec2(0.0);
        // No-slip condition: velocity is zero at boundary
        // Free-slip: velocity.n = 0 (more complex)
    }
    
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
