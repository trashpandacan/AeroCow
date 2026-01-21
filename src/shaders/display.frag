varying vec2 vUv;
uniform sampler2D uTexture;

void main() {
    vec3 color = texture2D(uTexture, vUv).rgb;
    float intensity = length(color);

    // Boost contrast significantly for visibility
    intensity = pow(intensity, 0.5) * 2.0;
    intensity = clamp(intensity, 0.0, 1.0);

    // Cyan/blue smoke color with good visibility
    vec3 smokeColor = mix(
        vec3(0.0, 0.1, 0.15),  // Dark background tint
        vec3(0.2, 0.8, 1.0),   // Bright cyan smoke
        intensity
    );

    gl_FragColor = vec4(smokeColor, intensity * 0.9);
}
