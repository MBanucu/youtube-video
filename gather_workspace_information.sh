#!/usr/bin/env bash

# ────────────────────────────────────────────────────────────────
# Helper: Print a centered header with double-line borders
# ────────────────────────────────────────────────────────────────
print_header() {
    local text="$1"
    local width=70                  # you can change this value
    local text_length=${#text}
    local padding=$(( (width - text_length) / 2 ))

    # Top border
    printf '═%.0s' $(seq 1 "$width")
    echo ""

    # Centered text
    printf "%*s%s%*s\n" "$padding" "" "$text" "$padding" ""

    # Bottom border
    printf '═%.0s' $(seq 1 "$width")
    echo ""
}

# ────────────────────────────────────────────────────────────────
# Main function
# ────────────────────────────────────────────────────────────────
gather_workspace_info() {
    local project_root="${1:-.}"

    local main_header="Project workspace overview @ ${project_root}"
    print_header "$main_header"

    echo ""


    # Tree section
    local tree_command="tree -a -I 'node_modules|.git|dist|build|.next|.turbo|coverage|.direnv'"
    print_header "$tree_command"

    tree -a -I 'node_modules|.git|dist|build|.next|.turbo|coverage|.direnv' "$project_root" 2>/dev/null ||
        echo "(tree command failed or directory is empty)"
    echo ""
    echo ""

    # Collect nix files recursively, excluding ignored directories
    local nix_files=($(find "$project_root" -type d \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .next -o -name .turbo -o -name coverage -o -name .direnv \) -prune -o -type f -name "*.nix" -printf "%P\n"))
    # Collect md files in the root directory only
    local md_files=($(find "$project_root" -maxdepth 1 -type f -name "*.md" -printf "%P\n"))

    # File listing section
    local files=(
        "biome.json"
        ".github/workflows/test.yml"
        "knip.jsonc"
        "lefthook.yml"
        "package.json"
        "tsconfig.json"
        "${nix_files[@]}"  # Add all nix files here
        "${md_files[@]}"   # Add all markdown files here
    )

    for file in "${files[@]}"; do
        print_header "cat $file"

        if [[ -f "$project_root/$file" ]]; then
            cat "$project_root/$file"
        else
            echo "→ File does not exist in ${project_root}"
        fi

        echo ""
        echo ""
    done

    # Footer
    printf '═%.0s' $(seq 1 70)
    echo ""
    echo "Done"
    printf '═%.0s' $(seq 1 70)
    echo ""
}

# ────────────────────────────────────────────────────────────────
# Run it
# ────────────────────────────────────────────────────────────────
gather_workspace_info "$@"