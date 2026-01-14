/**
 * Get the duration of a video file using ffprobe.
 * @param file Path to the video file
 * @returns Duration in seconds
 */
export async function ffprobeDuration(file: string): Promise<number> {
  const proc = Bun.spawn(
    [
      'ffprobe',
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ],
    { stderr: 'inherit' },
  )
  const out = await new Response(proc.stdout).text()
  const val = parseFloat(out.trim())
  if (Number.isNaN(val)) throw new Error(`Unable to get duration for ${file}`)
  return val
}
