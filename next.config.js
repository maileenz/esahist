/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import("next").NextConfig} */
const config = {
  allowedDevOrigins: ["192.168.100.97"],

  /**
   * What the Docker image ships.
   *
   * Next traces the modules the server actually reaches and writes a
   * self-contained tree under `.next/standalone`, so the runtime image needs no
   * package manager, no install step and none of the build toolchain. Without
   * it the only way to run the server in a container is to ship all of
   * node_modules and hope.
   */
  output: "standalone",
};

/**
 * The path is explicit rather than left to discovery. The plugin's default
 * looks in a couple of conventional places, and when it misses, every server
 * render fails with "Couldn't find next-intl config file" — naming it costs a
 * string and cannot miss.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(config);
