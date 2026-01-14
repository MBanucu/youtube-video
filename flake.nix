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

        # Wrapped bun/bunx with BIOME_BINARY set automatically
        wrappedBun = pkgs.symlinkJoin {
          name = "wrapped-bun";
          paths = [ pkgs.bun ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = ''
            wrapProgram $out/bin/bun --set BIOME_BINARY "${pkgs.biome}/bin/biome"
            if [ -e $out/bin/bunx ]; then
              wrapProgram $out/bin/bunx --set BIOME_BINARY "${pkgs.biome}/bin/biome"
            else
              ln -s $out/bin/bun $out/bin/bunx
              wrapProgram $out/bin/bunx --set BIOME_BINARY "${pkgs.biome}/bin/biome"
            fi
          '';
        };

        runtimeInputs = [
          wrappedBun # Use wrapped version instead of pkgs.bun
          pkgs.ffmpeg
          pythonEnv
          pkgs.biome
          pkgs.lefthook
        ];

        # Reusable function to create bun/bunx apps (no export needed now)
        makeBunApp =
          name: execCmd:
          flake-utils.lib.mkApp {
            drv = pkgs.writeShellApplication {
              inherit name;
              inherit runtimeInputs;
              text = ''
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
          # No shellHook needed anymore
        };
      }
    );
}
