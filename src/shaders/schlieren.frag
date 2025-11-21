varying vec2 vUv;
uniform sampler2D uPressure;
uniform vec2 texelSize;
uniform float intensity;

void main() {
    float L = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float R = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float T = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float B = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;

    vec2 grad = vec2(R - L, T - B) * 0.5;
    float mag = length(grad) * intensity;
    
    // Heatmap: Black -> Blue -> White -> Red
    vec3 color = vec3(0.0);
    if (mag < 0.5) {
        color = mix(vec3(0.0, 0.0, 0.1), vec3(0.0, 0.5, 1.0), mag * 2.0);
    } else {
        color = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.2, 0.0), (mag - 0.5) * 2.0);
    }
    
    gl_FragColor = vec4(color, 1.0);
}
