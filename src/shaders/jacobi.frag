varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;
uniform float alpha;
uniform float rBeta;

void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;

    float bC = texture2D(uDivergence, vUv).x;

    float p = (L + R + B + T + alpha * bC) * rBeta;
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
}
