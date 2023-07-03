/*
 * What do I do once I'm done with this jam?
 *
 * There's a billion ways you could extend it! Here are some things I really want to do:
 *  - Use any one of the APIs in your own project! Here are some examples:
 *      - DIY transcript app by connecting YouTube videos to SpeechRecognition API!
 *      - Train Teachable Machine to do other things! I have a guitar so maybe I'll teach it to recognize chords so I can make my own Guitar Hero or something...
 *  - Or you can make this your own!
 *      - Thomas here at HC is changing the Teachable Machine so it only listens when his hand is up!
 *      - What if you had a password to unlock your assistant? Train Teachable Machine to recognize you drawing digits in the air to unlock your assistant!
 *      - Redesign the UI! Ours is a phone but maybe yours is Jarvis ;)
 *      - Add messages to localStorage so your AI can remember what it asked you last time!
 */

// Let's set up some constants!
// Normally it isn't safe to store your API key client-side because other people can get ahold of it... but we'll do this for the workshop. Besides, it's your personal assistant!
const URL = 'https://teachablemachine.withgoogle.com/models/hiSl8IOc-/'
const API_KEY = ''
const THRESHOLD = 0.9

let listening = false
let result = null
let messages = []

function addMessage({ role, content }) {
  let message = document.createElement('div')
  message.innerText = content
  if (role === 'user') message.classList.add('user')
  else message.classList.add('system')
  document.getElementById('messages').appendChild(message)
  message.scrollIntoView(false) // Scroll to the message
}

async function speak(message) {
  return new Promise((resolve, reject) => {
    let synth = window.speechSynthesis
    if (synth) {
      let utterance = new SpeechSynthesisUtterance(message)
      // Lots of voices to choose from!
      // One extension option is to add a setting that lets people choose their assistant's voice
      // const voices = synth.getVoices()
      // utterance.voice = voices[voices.findIndex(voice => voice.name === 'Good News')]
      // utterance.rate = 1
      synth.cancel()
      synth.speak(utterance)
      utterance.onend = resolve
    } else {
      reject('speechSynthesis not supported')
    }
  })
}

async function hear() {
  return new Promise((resolve, reject) => {
    let SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    let recognition = new SpeechRecognition()
    recognition.start()
    recognition.addEventListener('result', function (event) {
      let current = event.resultIndex
      let transcript = event.results[current][0].transcript
      recognition.stop()
      resolve(transcript)
    })
  })
}

async function answer(message) {
  return new Promise((resolve, reject) => {
    // Add to list of messages that user can see
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [...messages, message]
      })
    })
      .then(response => response.json())
      .then(json => {
        let { message: answer } = json.choices[0] // So here we do something called destructuring! ChatGPT returns to us its answer in the form of { choices: [{ message: "..."}] } so we get the first choice, and map message to answer so that the response is stored in the variable answer
        return resolve(answer)
      })
      .catch(err => {
        return reject(err.toString())
      })
  })
}

async function process() {
  document.getElementById('result').style.display = 'block'

  hear().then(result => {
    document.getElementById('result').style.display = 'none'

    let message = { role: 'user', content: result }
    addMessage(message)
    document.getElementById('loading').style.display = 'block'

    answer(message).then(response => {
      // Convert our answer to context now that an answer has been given
      response.role = 'system'

      // Let's add to our list of messages
      messages.push(response)
      addMessage(response)

      document.getElementById('loading').style.display = 'none'

      speak(response.content).then(() => {
        // Start listening for Orpheus again
        process()
      })
    })
  })
}

window.onload = () => {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    // SpeechRecognition not found
    alert("Hey! Looks like you don't have SpeechRecognition enabled yet.")
    return
  }

  result = document.getElementById('result') // This is where we'll store what the user is saying in real time

  // Here, we copy-paste our Teachable Machine model in!
  async function createModel() {
    const checkpointURL = URL + 'model.json' // model topology
    const metadataURL = URL + 'metadata.json' // model metadata

    const recognizer = speechCommands.create(
      'BROWSER_FFT', // fourier transform type, not useful to change
      undefined, // speech commands vocabulary feature, not useful for your models
      checkpointURL,
      metadataURL
    )

    // check that model and metadata are loaded via HTTPS requests.
    await recognizer.ensureModelLoaded()

    return recognizer
  }

  async function init() {
    recognizer = await createModel()
    document.getElementById('startup').innerText =
      'Orpheus just joined the chat'

    // listen() takes two arguments:
    // 1. A callback function that is invoked anytime a word is recognized.
    // 2. A configuration object with adjustable fields
    recognizer.listen(
      result => {
        const orpheusNoise = result.scores[1]
        if (orpheusNoise > THRESHOLD && !listening) {
          listening = true
          speak('Hey!').then(() => {
            process()
          })
        }
      },
      {
        includeSpectrogram: true, // in case listen should return result.spectrogram
        probabilityThreshold: 0.75, // Edit this to change the accuracy of your model!
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.5 // probably want between 0.5 and 0.75. More info in README
      }
    )
  }

  init()
}
