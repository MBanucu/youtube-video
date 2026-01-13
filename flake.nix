{
  description = "Dev shell for bun + ffmpeg + faster-whisper transcription";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        pythonPackages =
          ps: with ps; [
            faster-whisper
            pysubs2
          ];
        pythonEnv = pkgs.python313.withPackages pythonPackages;
        runtimeInputs = [
          pkgs.bun
          pkgs.ffmpeg
          pythonEnv
        ];
      in
      {
        apps.bun = flake-utils.lib.mkApp {
          drv = pkgs.writeShellApplication {
            name = "bun";
            runtimeInputs = runtimeInputs;
            text = ''
              exec bun "$@"
            '';
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = runtimeInputs;
          shellHook = ''
            echo "Bun, ffmpeg, and Python+faster-whisper available!"
            bun --version
            ffmpeg -version
            python3 --version
            python3 -c "import faster_whisper; print('faster-whisper is ready!')"
          '';
        };
      }
    );
}
