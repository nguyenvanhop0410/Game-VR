# VR Color Circle - Three.js + WebXR

Project do an cuoi ky VR duoc xay dung hoan toan bang web (Three.js + WebXR), khong dung Unity.

## Muc tieu
- Nhan dien va phan loai mau theo 3 cap do.
- Gameplay tuong tac: nhat bi mau va dat vao dung vi tri tren vong tron mau.
- Chay duoc tren web, co the ket noi kinh VR ho tro WebXR.

## Tinh nang
- Level 1: Primary
- Level 2: Secondary
- Level 3: Tertiary
- Easy mode: khong gioi han thoi gian
- Hard mode: co gioi han thoi gian
- Am thanh nen + SFX thao tac (pick/correct/wrong/win/lose)

## Cong nghe
- Three.js
- WebXR API (qua renderer.xr + VRButton)
- Vite

## Chay local
```bash
npm install
npm run dev
```

Mo trinh duyet tai dia chi Vite hien ra (thuong la http://localhost:5173).

## Build
```bash
npm run build
npm run preview
```

## Deploy len GitHub Pages (khuyen dung de test VR)
1. Tao repo GitHub va push code len nhanh `main`.
2. Vao `Settings > Pages` trong repo:
	- `Build and deployment` -> `Source`: chon `GitHub Actions`.
3. Sau moi lan push nhanh `main`, workflow `Deploy to GitHub Pages` tu build va publish.
4. Link app se co dang:
	- `https://<github-username>.github.io/<repo-name>/`
5. Mo link HTTPS nay tren trinh duyet cua kinh (Meta Quest Browser), bam `Enter VR` de vao game.

## Chay tren kinh VR
1. Trinh duyet tren kinh phai ho tro WebXR (vi du Meta Quest Browser).
2. Truy cap URL app (localhost tren may tinh de test desktop, hoac host trong LAN/HTTPS de mo tren headset).
3. Nhan nut Enter VR do VRButton tao.

## Cau truc
- index.html: HUD + nut Start/Reset
- src/main.js: toan bo game logic (scene, level, timer, controller interaction, audio)
- src/styles.css: giao dien HUD

## Luu y hieu nang
- Dung hinh khoi don gian, so draw calls thap.
- Gioi han pixel ratio (Math.min(devicePixelRatio, 2)).
- Logic update gon, va vat the spawn theo level.
