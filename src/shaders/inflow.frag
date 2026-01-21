varying vec2 vUv;
uniform sampler2D uVelocity;
uniform float speed;

void main() {
    vec2 velocity = texture2D(uVelocity, vUv).xy;

    // Force inflow at left boundary - wider inflow region for stability
    // Speed is scaled to work with advection (grid units per second)
    float inflowWidth = 0.05;
    if (vUv.x < inflowWidth) {
        // Smooth transition for stability
        float blend = smoothstep(0.0, inflowWidth, vUv.x);
        vec2 inflowVel = vec2(speed * 50.0, 0.0); // Scale for visible advection
        velocity = mix(inflowVel, velocity, blend);
    }

    // Outflow at right boundary - zero gradient (open boundary)
    if (vUv.x > 0.95) {
        velocity.x = max(velocity.x, 0.0); // Allow flow to exit
    }

    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
