# Set up this Windows PC for the GT4 build

You do not need to upload a development environment. Install it on this PC, then this workspace can use it. Visitors will not need WSL, Ubuntu or a compiler.

1. Save your work and open **PowerShell as administrator** (Start → search PowerShell → Run as administrator).
2. Run:

   ```powershell
   wsl --install -d Ubuntu
   ```

3. Restart if requested. Open **Ubuntu** from Start and finish its Linux username/password setup. Keep that password private and enter it yourself when asked.
4. In Ubuntu, install the tools:

   ```bash
   sudo apt update
   sudo apt install git cmake ninja-build clang python3 p7zip-full
   ```

   Confirm apt's prompt. Password entry normally displays no characters.
5. Verify in ordinary Windows PowerShell:

   ```powershell
   wsl --list --verbose
   wsl -d Ubuntu -- bash -lc 'cmake --version; ninja --version; clang --version; python3 --version'
   ```

   Ubuntu should show version **2** in the WSL list. Tell me when setup is complete; I can inspect the installed tools and work on the private GT4 build here. No ISO or BIOS needs to be uploaded.

These follow Microsoft's [WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install). If installation reports a virtualization/Windows feature error, retain its exact message so we can diagnose the machine's actual issue.

After setup, [GT4.md](GT4.md) has the commands for copying the existing downloaded source into Ubuntu, running `port.sh` on the exact US disc, and connecting the private browser output. Upstream needs Git, CMake, Ninja, a C++20 compiler and Python. Its first build obtains Emscripten and wgpu-native and needs Internet access. See the [upstream build instructions](https://github.com/snuri00/ps2-web-recomp).

WSL is our proposed route for the Linux scripts on Windows; upstream documents Linux/macOS rather than a tested native Windows build. Tool installation does not guarantee this US edition will work. A build still needs race, graphics, controls, save, sound and performance checks. Public hosting is a later step described in [PUBLIC-ARCADE.md](PUBLIC-ARCADE.md).

No WSL or OS installation was performed during this cabinet update.
