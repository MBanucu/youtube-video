#!/usr/bin/env python3
import argparse
from faster_whisper import WhisperModel
import pysubs2

def main():
    parser = argparse.ArgumentParser(description="Transcribe speech audio using faster-whisper")
    parser.add_argument("input", nargs="?", default="audio.wav", help="Path to input audio file")
    parser.add_argument("--model", default="small", choices=["tiny", "base", "small", "medium", "large-v2"], help="Whisper model size")
    parser.add_argument("--language", default="de", help="Transcription language (e.g., 'de' for German, 'en' for English)")
    parser.add_argument("--output", help="Output text file (optional)")
    parser.add_argument("--beam_size", type=int, default=5, help="Beam size for decoding")
    parser.add_argument("--vad_filter", action="store_true", help="Enable voice activity detection")
    args = parser.parse_args()

    print(f"Loading faster-whisper model: {args.model}")
    model = WhisperModel(args.model, device="auto")
    print(f"Transcribing {args.input} (language={args.language})...")

    segments, info = model.transcribe(
        args.input,
        language=args.language,
        beam_size=args.beam_size,
        vad_filter=args.vad_filter,
    )

    # Create subtitles using pysubs2:
    subs = pysubs2.load_from_whisper(list(segments))
    srt_path = args.output if args.output and args.output.endswith(".srt") else (args.output + ".srt" if args.output else None)

    if srt_path:
        subs.save(srt_path, format_="srt")
        print(f"SRT written to {srt_path}")
    else:
        print(subs.to_string("srt"))

    # Still output raw transcript to text file if requested
    transcript = ""
    for segment in segments:
        transcript += f"[{segment.start:.2f}  {segment.end:.2f}] {segment.text.strip()}\n"
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(transcript)
        print(f"Transcript written to {args.output}")
    else:
        print("\n--- Transcript ---")
        print(transcript)


if __name__ == "__main__":
    main()
