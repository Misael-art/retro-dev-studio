OUTPUT_FORMAT("elf32-m68k")
OUTPUT_ARCH(m68k)
ENTRY(semantic_harness)
SECTIONS
{
  .image 0x00000000 : { *(.image) }
  /DISCARD/ : { *(.comment) *(.note*) *(.eh_frame*) }
}
