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

        # Reusable function to create bun/bunx apps
        makeBunApp =
          name: execCmd:
          flake-utils.lib.mkApp {
            drv = pkgs.writeShellApplication {
              inherit name;
              inherit runtimeInputs;
              text = ''
                export BIOME_BINARY="${pkgs.biome}/bin/biome"
                exec ${execCmd} "$@"
              '';
            };
          };
      in
      {
        apps.bun = makeBunApp "bun" "bun";
        apps.bunx = makeBunApp "bunx" "bunx";

        devShells.default = pkgs.mkShell {
          buildInputs = runtimeInputs;
          shellHook = ''
            export BIOME_BINARY="${pkgs.biome}/bin/biome"
          '';
        };
      }
    );
}
