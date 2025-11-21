varying vec2 vUv;
uniform sampler2D uTexture;

void main() {
    vec3 color = texture2D(uTexture, vUv).rgb;
    float intensity = length(color);
    // Show actual density with blue tint and transparency
    gl_FragColor = vec4(color * vec3(0.2, 0.6, 1.0), intensity * 0.6);
}
