varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 texelSize;

void main() {
    float L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).y;
    float B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).y;

    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vUv.x < 0.0) { L = -C.x; }
    if (vUv.x > 1.0) { R = -C.x; }
    if (vUv.y < 0.0) { B = -C.y; }
    if (vUv.y > 1.0) { T = -C.y; }

    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}
