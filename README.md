# TV Manager

App macOS quan ly Android TV qua ADB Wi-Fi, tich hop [CleanYourTV](https://github.com/Gathin23/cleanyourtv).

Giao dien do hoa (Electron) thay the viec go lenh terminal, giup tat bloatware, sap xep launcher va dieu khien TV tu may tinh.

![Screenshot](docs/screenshot.png)

## Tinh nang

- **Ket noi TV** - Ket noi/ngat qua IP va port, hien thi thong tin thiet bi (model, Android, SDK)
- **Quan ly ung dung** - Liet ke tat ca packages, loc theo trang thai (dang bat / da tat / he thong), tim kiem, disable/enable tung app
- **Don dep thong minh** - Quet bloatware tu danh sach CleanYourTV theo model TV, tick chon va tat hang loat, tu dong backup truoc khi don
- **Dieu khien remote** - D-pad (len/xuong/trai/phai/OK), Home, Back, Volume, Power, Play/Pause, Menu
- **Screenshot** - Chup man hinh TV hien thi trong app
- **Backup / Restore** - Luu danh sach packages va trang thai ra file JSON, khoi phuc bat ky luc nao
- **Launcher** - Cai/cap nhat CleanYourTV launcher, chon theme co san, sap xep thu tu dock apps (keo tha), upload hinh nen tuy chinh

## Yeu cau

- **Node.js** >= 18
- **ADB** (Android Debug Bridge): `brew install android-platform-tools`
- **CleanYourTV repo** clone ben canh thu muc nay:

```
TVMCN/
  cleanyourtv/    # git clone https://github.com/Gathin23/cleanyourtv
  tv-manager-app/ # repo nay
```

## Cai dat va chay

```bash
npm install
npm start
```

## Cach hoat dong

1. Bat USB Debugging tren TV (Settings > Developer options)
2. Nhap IP cua TV vao app, bam Ket noi
3. Chap nhan "Allow USB debugging" tren TV

App su dung `adb connect` qua Wi-Fi. Moi thao tac disable deu dung `pm disable-user --user 0`, khong bao gio go cai (`pm uninstall`). Tat ca thay doi co the hoan tac bang cach bat lai tung app hoac restore tu file backup.

## Cau truc

| File | Mo ta |
|---|---|
| `main.js` | Electron main process, IPC handlers |
| `preload.js` | Context bridge giua main va renderer |
| `adb.js` | ADB command wrapper |
| `index.html` | Giao dien chinh |
| `styles.css` | Dark theme CSS |
| `renderer.js` | Frontend logic |

## Credits

Xay dung tren nen tang [CleanYourTV](https://github.com/Gathin23/cleanyourtv) cua [Gathin23](https://github.com/Gathin23). App nay su dung danh sach bloatware, launcher va themes tu repo do.

## License

MIT
