"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ShieldScene() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const container = host;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.05, 9.3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.set(-0.12, -0.36, -0.04);
    group.scale.setScalar(0.88);
    scene.add(group);

    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 2.65);
    shieldShape.bezierCurveTo(1.45, 2.55, 2.35, 2.0, 2.55, 1.82);
    shieldShape.bezierCurveTo(2.45, 0.2, 2.08, -1.1, 1.35, -2.0);
    shieldShape.bezierCurveTo(0.82, -2.64, 0.28, -3.0, 0, -3.12);
    shieldShape.bezierCurveTo(-0.28, -3.0, -0.82, -2.64, -1.35, -2.0);
    shieldShape.bezierCurveTo(-2.08, -1.1, -2.45, 0.2, -2.55, 1.82);
    shieldShape.bezierCurveTo(-2.35, 2.0, -1.45, 2.55, 0, 2.65);

    const shieldGeometry = new THREE.ExtrudeGeometry(shieldShape, {
      bevelEnabled: true,
      bevelSegments: 18,
      bevelSize: 0.12,
      bevelThickness: 0.11,
      curveSegments: 42,
      depth: 0.62
    });
    shieldGeometry.center();

    const shieldMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.78,
      clearcoatRoughness: 0.16,
      color: new THREE.Color("#00766f"),
      metalness: 0.2,
      roughness: 0.34,
      transmission: 0.08
    });
    const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
    shield.castShadow = true;
    shield.receiveShadow = true;
    group.add(shield);

    const rimPoints = shieldShape.getPoints(96).map((point) => new THREE.Vector3(point.x, point.y, 0.58));
    const rimCurve = new THREE.CatmullRomCurve3(rimPoints, true, "centripetal");
    const rim = new THREE.Mesh(
      new THREE.TubeGeometry(rimCurve, 192, 0.045, 12, true),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.65,
        color: new THREE.Color("#f0d889"),
        metalness: 0.72,
        roughness: 0.22
      })
    );
    rim.scale.set(1.018, 1.018, 1);
    group.add(rim);

    const innerShield = new THREE.Mesh(
      shieldGeometry.clone(),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.85,
        clearcoatRoughness: 0.1,
        color: new THREE.Color("#12a89a"),
        metalness: 0.08,
        opacity: 0.8,
        roughness: 0.2,
        transparent: true
      })
    );
    innerShield.position.z = 0.44;
    innerShield.scale.set(0.76, 0.76, 0.08);
    group.add(innerShield);

    const slashGeometry = new THREE.BoxGeometry(3.2, 0.28, 0.16);
    const slash = new THREE.Mesh(
      slashGeometry,
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.65,
        color: new THREE.Color("#f6fbf7"),
        metalness: 0.08,
        roughness: 0.18
      })
    );
    slash.position.set(-0.04, 0.78, 0.74);
    slash.rotation.z = 0.26;
    slash.castShadow = true;
    group.add(slash);

    const checkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.72, -0.18, 0.86),
      new THREE.Vector3(-0.26, -0.68, 0.86),
      new THREE.Vector3(0.86, 0.5, 0.86)
    ]);
    const check = new THREE.Mesh(
      new THREE.TubeGeometry(checkCurve, 36, 0.04, 12, false),
      new THREE.MeshPhysicalMaterial({
        clearcoat: 0.55,
        color: new THREE.Color("#f7e8ad"),
        metalness: 0.45,
        roughness: 0.18
      })
    );
    check.castShadow = true;
    group.add(check);

    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.012, 16, 140),
      new THREE.MeshBasicMaterial({ color: "#f4d991", transparent: true, opacity: 0.32 })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.z = -0.15;
    group.add(glow);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.35, 96),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    ground.position.set(0, -2.85, -1.25);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    scene.add(new THREE.HemisphereLight("#dffcf7", "#062d35", 1.25));
    const keyLight = new THREE.DirectionalLight("#ffffff", 3.2);
    keyLight.position.set(3.6, 5.2, 5.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const tealLight = new THREE.PointLight("#16d7c5", 2.4, 9);
    tealLight.position.set(-2.8, 1.9, 2.8);
    scene.add(tealLight);

    const goldLight = new THREE.PointLight("#f4d991", 2.2, 9);
    goldLight.position.set(2.8, -1.6, 2.2);
    scene.add(goldLight);

    function resize() {
      const rect = container.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let frame = 0;
    let raf = 0;
    const animate = () => {
      frame += 0.01;
      group.rotation.y = -0.36 + Math.sin(frame) * 0.08;
      group.rotation.x = -0.12 + Math.cos(frame * 0.8) * 0.035;
      group.position.y = Math.sin(frame * 1.3) * 0.08;
      glow.rotation.z += 0.006;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      container.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  return <div className="shield-canvas" ref={hostRef} aria-hidden="true" />;
}
