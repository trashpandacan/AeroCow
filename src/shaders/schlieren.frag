varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform vec2 texelSize;
uniform float intensity;

void main() {
    // Sample velocity field for gradient visualization
    vec2 L = texture2D(uVelocity, vUv - vec2(texelSize.x, 0.0)).xy;
    vec2 R = texture2D(uVelocity, vUv + vec2(texelSize.x, 0.0)).xy;
    vec2 T = texture2D(uVelocity, vUv + vec2(0.0, texelSize.y)).xy;
    vec2 B = texture2D(uVelocity, vUv - vec2(0.0, texelSize.y)).xy;

    // Calculate velocity gradient magnitude (curl/vorticity)
    float vorticity = (R.y - L.y) - (T.x - B.x);

    // Also calculate divergence for additional detail
    float divergence = (R.x - L.x) + (T.y - B.y);

    // Pressure gradient for shock detection
    float pL = texture2D(uPressure, vUv - vec2(texelSize.x, 0.0)).x;
    float pR = texture2D(uPressure, vUv + vec2(texelSize.x, 0.0)).x;
    float pT = texture2D(uPressure, vUv + vec2(0.0, texelSize.y)).x;
    float pB = texture2D(uPressure, vUv - vec2(0.0, texelSize.y)).x;
    float pressureGrad = length(vec2(pR - pL, pT - pB));

    // Combine signals with scaling
    float vorticityMag = abs(vorticity) * intensity * 0.5;
    float divMag = abs(divergence) * intensity * 0.2;
    float pressMag = pressureGrad * intensity * 10.0;

    // Vorticity coloring: blue for CCW, red for CW rotation
    vec3 vortColor = vec3(0.0);
    if (vorticity > 0.0) {
        vortColor = vec3(0.0, 0.4, 1.0) * min(vorticityMag, 1.0);
    } else {
        vortColor = vec3(1.0, 0.2, 0.0) * min(vorticityMag, 1.0);
    }

    // Pressure gradient as white highlights
    vec3 pressColor = vec3(1.0, 0.9, 0.8) * min(pressMag, 1.0);

    // Combine
    vec3 finalColor = vortColor + pressColor * 0.5;

    // Add base tint for visibility
    float totalMag = vorticityMag + pressMag * 0.5;
    float alpha = clamp(totalMag * 0.8, 0.0, 0.9);

    gl_FragColor = vec4(finalColor, alpha);
}
