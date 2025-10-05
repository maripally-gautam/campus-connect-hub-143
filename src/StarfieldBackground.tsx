import { useRef, useEffect } from "react";
import * as THREE from "three";

const StarfieldBackground: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0010);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1200);
    camera.position.set(0, 5, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000);

    mountRef.current?.appendChild(renderer.domElement);

    // Generate star positions
    const count = 6000;
    const pos: number[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = THREE.MathUtils.randFloat(40, 120);
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
      pos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      // Give random initial size, some larger for glowing effect
sizes.push(Math.random() < 0.02 ? 2.5 : 0.5 + Math.random() * 0.35);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));

    // Custom shader material for per-point size and glow
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `
        attribute float size;
        varying float vSize;
        void main() {
          vSize = size;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vSize;
        void main() {
          float distanceToCenter = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.1, distanceToCenter);
          gl_FragColor = vec4(color, alpha);
          // Extra glow for bigger stars
          if(vSize > 1.0) {
            gl_FragColor.rgb *= 1.8;
            gl_FragColor.a *= 1.4;
          }
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    // Animation: twinkle some stars by randomly boosting their size
    const animate = () => {
      const sizes = geometry.getAttribute("size");
      for (let i = 0; i < count; i++) {
        let base = sizes.getX(i);
        // Twinkle 2% stars
        if (base > 1.0) {
          sizes.setX(i, 1.2 + Math.sin(Date.now() * 0.002 + i) * 0.4);
        }
      }
      sizes.needsUpdate = true;

      stars.rotation.y += 0.0008;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        top: 0,
        left: 0,
        zIndex: -1,
        pointerEvents: "none"
      }}
    />
  );
};

export default StarfieldBackground;
