{
  description = "Dev shell for bun + ffmpeg tools";

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
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.bun
            pkgs.ffmpeg
          ];
          shellHook = ''
            echo "Bun and ffmpeg (including ffprobe) are available."
            bun --version
            ffmpeg -version
            ffprobe -version
          '';
        };
      }
    );
}
