
# Panduan Instalasi Arch Linux (Metode Manual)

Panduan ini akan memandu Anda melalui proses instalasi Arch Linux secara manual, memberikan Anda kontrol penuh atas sistem Anda.

**Peringatan:** Proses ini ditujukan untuk pengguna tingkat lanjut. Jika Anda baru mengenal Linux, disarankan untuk menggunakan `archinstall` script yang lebih mudah.

---

## Bagian 1: Pra-Instalasi

### 1.1. Unduh Arch Linux ISO
Kunjungi halaman [unduhan resmi Arch Linux](https://archlinux.org/download/) dan dapatkan file ISO terbaru.

### 1.2. Buat Media Instalasi Bootable
Gunakan tools seperti **Rufus**, **balenaEtcher**, atau `dd` untuk membuat USB drive bootable dari file ISO yang telah diunduh.

**Contoh menggunakan `dd` di Linux:**
```bash
# Ganti /dev/sdX dengan path USB drive Anda (misal: /dev/sdb)
sudo dd bs=4M if=/path/to/archlinux.iso of=/dev/sdX status=progress oflag=sync
```

### 1.3. Boot dari Media Instalasi
- Masukkan USB drive ke komputer target.
- Restart komputer dan masuk ke menu boot (biasanya dengan menekan F2, F10, F12, atau DEL).
- Pilih untuk boot dari USB drive Anda.
- Anda akan disambut oleh prompt shell Arch Linux.

---

## Bagian 2: Konfigurasi Awal

### 2.1. Atur Layout Keyboard (Opsional)
Layout default adalah US. Jika Anda menggunakan layout lain, daftar dulu:
```bash
ls /usr/share/kbd/keymaps/**/*.map.gz
```
Kemudian atur layout yang sesuai:
```bash
# Contoh untuk layout Jerman
loadkeys de-latin1
```

### 2.2. Verifikasi Mode Boot
Pastikan Anda boot dalam mode UEFI.
```bash
ls /sys/firmware/efi/efivars
```
Jika direktori tersebut ada, Anda berada dalam mode UEFI. Jika tidak, Anda mungkin dalam mode BIOS. Panduan ini berfokus pada UEFI.

### 2.3. Hubungkan ke Internet
- **Untuk Ethernet:** Koneksi biasanya otomatis terdeteksi.
- **Untuk Wi-Fi:** Gunakan `iwctl`.
  ```bash
  # Masuk ke shell interaktif iwctl
  iwctl
  
  # Lihat daftar perangkat Wi-Fi (misal: wlan0)
  device list
  
  # Pindai jaringan
  station wlan0 scan
  
  # Lihat daftar jaringan yang tersedia
  station wlan0 get-networks
  
  # Hubungkan ke jaringan (ganti "MyNetwork")
  station wlan0 connect "MyNetwork"
  
  # Masukkan password Anda, lalu keluar
  exit
  ```
Verifikasi koneksi:
```bash
ping archlinux.org
```

### 2.4. Perbarui Jam Sistem
```bash
timedatectl set-ntp true
```

---

## Bagian 3: Partisi dan Format Disk

### 3.1. Identifikasi Disk
```bash
lsblk
```
Identifikasi disk target Anda (misal: `/dev/nvme0n1` atau `/dev/sda`).

### 3.2. Partisi Disk
Gunakan `fdisk` atau `parted` untuk membuat partisi. Contoh ini menggunakan `fdisk` untuk skema partisi UEFI dasar.
```bash
fdisk /dev/sdX
```
Di dalam `fdisk`:
1.  `g` - Buat tabel partisi GPT baru.
2.  `n` - Buat partisi baru untuk EFI System Partition (ESP).
    - Partition number: 1
    - First sector: default
    - Last sector: `+512M`
3.  `t` - Ubah tipe partisi.
    - Pilih partisi 1.
    - Tipe: `EFI System` (atau nomor 1).
4.  `n` - Buat partisi baru untuk root (`/`).
    - Partition number: 2
    - First sector: default
    - Last sector: default (gunakan sisa ruang)
5.  `w` - Tulis perubahan dan keluar.

### 3.3. Format Partisi
- Format partisi EFI sebagai FAT32.
  ```bash
  mkfs.fat -F32 /dev/sdX1
  ```
- Format partisi root sebagai ext4.
  ```bash
  mkfs.ext4 /dev/sdX2
  ```

### 3.4. Mount Partisi
- Mount partisi root.
  ```bash
  mount /dev/sdX2 /mnt
  ```
- Buat direktori boot dan mount partisi EFI.
  ```bash
  mkdir /mnt/boot
  mount /dev/sdX1 /mnt/boot
  ```

---

## Bagian 4: Instalasi Sistem Dasar

### 4.1. Instal Paket Dasar
Gunakan `pacstrap` untuk menginstal kernel Linux dan paket dasar.
```bash
pacstrap /mnt base linux linux-firmware
```
Ini mungkin memakan waktu beberapa saat.

### 4.2. Hasilkan Fstab
File fstab mendefinisikan bagaimana partisi disk akan di-mount.
```bash
genfstab -U /mnt >> /mnt/etc/fstab
```
Verifikasi file fstab yang dihasilkan:
```bash
cat /mnt/etc/fstab
```

---

## Bagian 5: Konfigurasi Sistem

### 5.1. Chroot ke Sistem Baru
"Change root" ke sistem yang baru Anda instal untuk mulai mengkonfigurasinya.
```bash
arch-chroot /mnt
```

### 5.2. Atur Zona Waktu
```bash
# Ganti "Asia/Jakarta" dengan zona waktu Anda
ln -sf /usr/share/zoneinfo/Asia/Jakarta /etc/localtime
hwclock --systohc
```

### 5.3. Lokalisasi
1.  Edit `/etc/locale.gen` dan hapus tanda komentar `#` dari locale yang Anda butuhkan (misal: `en_US.UTF-8 UTF-8`).
    ```bash
    # Gunakan nano atau vim
    nano /etc/locale.gen
    ```
2.  Hasilkan locale.
    ```bash
    locale-gen
    ```
3.  Buat file `locale.conf`.
    ```bash
    echo "LANG=en_US.UTF-8" > /etc/locale.conf
    ```

### 5.4. Konfigurasi Jaringan
1.  Buat file hostname.
    ```bash
    echo "myarchpc" > /etc/hostname
    ```
2.  Tambahkan entri yang cocok di `hosts`.
    ```bash
    nano /etc/hosts
    ```
    Tambahkan baris berikut:
    ```
    127.0.0.1   localhost
    ::1         localhost
    127.0.1.1   myarchpc.localdomain  myarchpc
    ```
3.  Instal NetworkManager.
    ```bash
    pacman -S networkmanager
    systemctl enable NetworkManager
    ```

### 5.5. Atur Password Root
```bash
passwd
```
Masukkan password yang kuat untuk akun root.

### 5.6. Instal Boot Loader (GRUB)
```bash
# Instal paket yang diperlukan
pacman -S grub efibootmgr

# Instal GRUB ke partisi EFI
grub-install --target=x86_64-efi --efi-directory=/boot --bootloader-id=GRUB

# Hasilkan file konfigurasi GRUB
grub-mkconfig -o /boot/grub/grub.cfg
```

---

## Bagian 6: Langkah Akhir

### 6.1. Buat Pengguna Baru
Sangat disarankan untuk tidak menggunakan akun root untuk tugas sehari-hari.
```bash
# Ganti "yudha" dengan username Anda
useradd -m -G wheel yudha
passwd yudha
```
Beri pengguna baru hak `sudo` dengan mengedit file sudoers.
```bash
EDITOR=nano visudo
```
Temukan baris `%wheel ALL=(ALL:ALL) ALL` dan hapus tanda komentar `#`.

### 6.2. Instal Lingkungan Desktop (Opsional)
Anda dapat menginstal lingkungan desktop seperti GNOME atau KDE.

**Untuk GNOME:**
```bash
pacman -S gnome
systemctl enable gdm
```

**Untuk KDE Plasma:**
```bash
pacman -S plasma
systemctl enable sddm
```

### 6.3. Reboot
1.  Keluar dari lingkungan chroot.
    ```bash
    exit
    ```
2.  Unmount semua partisi.
    ```bash
    umount -R /mnt
    ```
3.  Reboot sistem.
    ```bash
    reboot
    ```

Keluarkan media instalasi USB Anda. Jika semua berjalan lancar, Anda akan boot ke instalasi Arch Linux baru Anda. Selamat!
