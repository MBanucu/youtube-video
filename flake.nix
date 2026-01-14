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
          pkgs.biome
          pkgs.lefthook
        ];
      in
      {
        apps.bun = flake-utils.lib.mkApp {
          drv = pkgs.writeShellApplication {
            name = "bun";
            runtimeInputs = runtimeInputs;
            text = ''
              export BIOME_BINARY="${pkgs.biome}/bin/biome"
              exec bun "$@"
            '';
          };
        };

        apps.bunx = flake-utils.lib.mkApp {
          drv = pkgs.writeShellApplication {
            name = "bunx";
            runtimeInputs = runtimeInputs;
            text = ''
              export BIOME_BINARY="${pkgs.biome}/bin/biome"
              exec bunx "$@"
            '';
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = runtimeInputs;
          shellHook = ''
            export BIOME_BINARY="${pkgs.biome}/bin/biome"
          '';
        };
      }
    );
}
