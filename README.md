# VR Color Circle Bowling - Three.js + WebXR

Project do an cuoi ky VR duoc xay dung hoan toan bang web (Three.js + WebXR), khong dung Unity.

## Muc tieu
- Hoc va ghi nho nhom mau Primary, Secondary, Tertiary qua co che bowling.
- Nhat bong mau tu Ball Return System, nem xuong lane, va danh trung bia dung mau.
- Chay duoc tren desktop de test nhanh va tren kinh VR ho tro WebXR.

## Gameplay
- Ball Return System dat ben canh nguoi choi, tu dong dua bong ve sau moi lan nem.
- Lane co bumper hai ben va target mau o cuoi duong bang.
- Bong co mo phong vat ly nhe: lan, nay, va cham bumper/cot/bia.
- Trung dung mau ghi diem, phat particle firework cung mau, phat tieng ping va rung controller.
- Sai mau hoac truot muc tieu tao khoi den va am thanh bao loi.

## Level
- Level 1 - Primary: 3 target Primary co dinh, bumper cao de ho tro.
- Level 2 - Mix Secondary: bat dau voi 3 bong Primary, nem vao o Primary khac mau de tao Orange/Green/Purple, roi hoan thanh 6 target Primary + Secondary.
- Level 3 - Mix Tertiary: bat dau voi bong Primary, nem vao pad Secondary de tao bong Tertiary, roi nem bong moi vao dung target Tertiary.

## Che do choi
- Easy: khong gioi han thoi gian, khong gioi han so bong.
- Hard: Time Attack. Neu nem trung sai mau, thoi gian bi tru 2 giay.

## Dieu khien
- Desktop: click bong o mang tra bong, sau do click lane hoac target de nem.
- Level 2 Desktop/VR: nem bong Primary vao o Primary khac mau de tao bong Secondary.
- Level 3 Desktop/VR: nem bong Primary vao o Secondary de tao bong Tertiary.
- VR: dung controller nhat bong, vung tay va tha trigger/select de nem.
- Nhan `F` de dua camera desktop ve goc gameplay.
- Nhan `Esc` de bo chon bong tren desktop.

## Cong nghe
- Three.js
- WebXR API (qua renderer.xr + VRButton)
- Vite
- Web Audio API cho BGM/SFX tong hop

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

## Cau truc
- `index.html`: HUD + nut Start/Reset/Next Level.
- `src/main.js`: scene, level, vat ly bowling, controller interaction, audio, VFX.
- `src/styles.css`: giao dien HUD.
