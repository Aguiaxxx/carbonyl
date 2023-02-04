const platforms = {
    macos: 'apple-darwin',
}
const archs = {
    arm64: 'aarch64',
    amd64: 'x86_64',
}
const triple = (arch, platform) => `${archs[arch]}-${platforms[platform]}`

export const jobs = ['arm64', 'amd64']
    .flatMap((arch) => [{ arch, platform: 'macos' }])
    .map(({ arch, platform }) => ({
        arch,
        platform,
        lib: `build/${triple(arch, os)}/release/libcarbonyl.dylib`,
        triple: triple(arch, os),
    }))
    .map(({ arch, platform, lib, triple }) => ({
        name: `Build for ${platform} on ${arch}`,
        agent: { tags: [platform, arch] },
        steps: [
            {
                name: 'Install Rust toolchain',
                command: `rustup target add ${triple}`,
            },
            {
                name: 'Build core library',
                command: `cargo build --target ${triple} --release`,
                env: { MACOSX_DEPLOYMENT_TARGET: '10.13' },
            },
            {
                if: platform === 'macos',
                name: 'Set core library install name',
                command: `install_name_tool -id @executable_path/libcarbonyl.dylib ${lib}`,
            },
            {
                name: 'Build Chromium',
                command: `
                    if ! scripts/runtime-pull.sh; then
                        export GIT_CACHE_PATH="$HOME/.cache/git"
                        export CCACHE_DIR="$HOME/.cache/ccache"
                        export CCACHE_CPP2=yes
                        export CCACHE_BASEDIR="/Volumes/Data/Refloat"
                        export CCACHE_SLOPPINESS=file_macro,time_macros,include_file_mtime,include_file_ctime,file_stat_matches,pch_defines
    
                        ccache --set-config=max_size=32G

                        scripts/gclient.sh sync
                        scripts/patches.sh apply
                        scripts/gn.sh gen out/Default --args='import("//carbonyl/src/browser/args.gn") use_lld=false is_debug=false symbol_level=0 cc_wrapper="ccache"'
                        scripts/build.sh Default
                        scripts/copy-binaries.sh Default
                    fi
                `,
            },
            {
                parallel: [
                    {
                        name: 'Push pre-built binaries',
                        env: {
                            CDN_ACCESS_KEY_ID: { secret: true },
                            CDN_SECRET_ACCESS_KEY: { secret: true },
                        },
                        command: `
                            if [ -d chromium/src/out/Default ]; then
                                scripts/runtime-push.sh
                            fi
                        `,
                    },
                    {
                        serial: [
                            {
                                command: `
                                    mkdir build/zip
                                    cp -r build/pre-built/${triple} build/zip/${triple}
                                    cp ${lib} build/zip/${triple}

                                    cd build/zip/${triple}
                                    zip -r package.zip .
                                `,
                            },
                            {
                                export: {
                                    artifact: {
                                        name: `carbonyl.${platform}-${arch}.zip`,
                                        path: `build/zip/${triple}/package.zip`,
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    }))
