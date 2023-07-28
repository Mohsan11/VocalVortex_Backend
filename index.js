const express = require("express");
const cors = require("cors");
const fetch = require("cross-fetch");
const { ChatOpenAI } = require("langchain/chat_models/openai");
const {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} = require("langchain/prompts");

const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();
const app = express();
const Port = process.env.PORT || 3001;

const { API_KEY, OPENAI_API_KEY } = process.env;
app.use(express.json());
app.use(cors());

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post("/summary", async (req, res) => {
  try {
    const { inputData, InputLanguage, OutputLanguage } = req.body;
    const cleanedInputData = removeLineBreaksAndCommas(inputData);

    console.log("Calling AI21 Studio API for text summarization...");
    const response = await fetch("https://api.ai21.com/studio/v1/summarize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: cleanedInputData,
        sourceType: "TEXT",
      }),
    });

    const data = await response.json();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Calling OpenAI API for image generation...");
    const imageResponse = await openai.createImage({
      prompt: data.summary,
      n: 1,
      size: "512x512",
    });
    let imageUrl = imageResponse.data.data[0].url;
    if (!imageUrl) {
      return (imageUrl = "");
    }
    const translatedText = await translateText(
      data.summary,
      InputLanguage,
      OutputLanguage
    );
    console.log("Done.");
    const Responses = { translatedText, imageUrl };
    res.status(200).send(Responses);
  } catch (err) {
    console.log("Error:", err.message);
    res.status(500).send("Error in processing the request!");
  }
});

const translateText = async (text, InputLanguage, OutputLanguage) => {
  try {
    console.log("Calling langchain API for Language Transformation...");
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "text-davinci-002", // Replace with the desired translation model
    });

    const translationPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are a helpful assistant that translates {input_language} to {output_language}."
      ),
      HumanMessagePromptTemplate.fromTemplate("{text}"),
    ]);

    const TranslatedText = await model.generatePrompt([
      await translationPrompt.formatPromptValue({
        input_language: InputLanguage,
        output_language: OutputLanguage,
        text,
      }),
    ]);

    return TranslatedText.generations[0][0].text;
  } catch (err) {
    throw new Error("Failed to translate the text.");
  }
};

function removeLineBreaksAndCommas(inputData) {
  // Remove line breaks
  const stringWithoutLineBreaks = inputData.replace(/\n/g, "");

  // Remove commas
  const stringWithoutCommas = stringWithoutLineBreaks.replace(/,/g, "");

  return stringWithoutCommas;
}

app.listen(Port, () => {
  console.log("Server is running on Port:", Port);
});
