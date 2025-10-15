const modeEmosiOptions = [
  { value: "calm", label: "Calm" },
  { value: "neutral", label: "Neutral" },
  { value: "excited", label: "Excited" },
  { value: "sad", label: "Sad" },
  { value: "disappointed", label: "Disappointed" }
];

const modeGayaOptions = [
  { value: "formal", label: "Formal" },
  { value: "informal", label: "Informal" },
  { value: "academic", label: "Academic" },
  { value: "conversational", label: "Conversational" },
];

const repeat = 3;

const fetchFileContent = await Bun.file("./input/fetch.ts")
  .text()
  .then((content) => {
    let result: {
      value: string;
      label: string;
    }[] = [];
    modeEmosiOptions.forEach((modeEmosi) => {
      modeGayaOptions.forEach((modeGaya) => {
        const replacedContent = content
          .replace("<PILIH_MODE_EMOSI>", modeEmosi.value)
          .replace("<PILIH_MODE_GAYA_BAHASA>", modeGaya.value);
        if(repeat > 1) {
          for(let i = 1; i <= repeat; i++) {
            result.push({
              value: replacedContent.replace("<HAPUS_FORUM_MAHASISWA>", "NO_SIR").replace("<RESPONSE_OUTPUT_FILE_NAME>", `response_${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}_${i}`),
              label: `${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}_${i}`,
            });
            result.push({
              value: replacedContent.replace("<HAPUS_FORUM_MAHASISWA>", "YES_SIR").replace("<RESPONSE_OUTPUT_FILE_NAME>", `response_${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}_${i}_no_forum`),
              label: `${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}_no_forum_${i}`,
            });
          }
        } else {
          result.push({
            value: replacedContent.replace("<HAPUS_FORUM_MAHASISWA>", "NO_SIR").replace("<RESPONSE_OUTPUT_FILE_NAME>", `response_${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}`),
            label: `${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}`,
          });
          result.push({
            value: replacedContent.replace("<HAPUS_FORUM_MAHASISWA>", "YES_SIR").replace("<RESPONSE_OUTPUT_FILE_NAME>", `response_${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}_no_forum`),
            label: `${modeEmosi.label.toLowerCase()}_${modeGaya.label.toLowerCase()}_no_forum`,
          });
        }
      });
    });
    return result;
  });

for (const item of fetchFileContent) {
  await Bun.write(`./output/fetch_${item.label}.ts`, item.value);
}
