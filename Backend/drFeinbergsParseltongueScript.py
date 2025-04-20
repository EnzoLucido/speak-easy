
#Feinberg, D. R. (2022, January 1). Parselmouth Praat Scripts in Python. https://doi.org/10.17605/OSF.IO/6DWR3 

#Measure pitch of all wav files in directory
import parselmouth
from parselmouth.praat import call

# This is the function to measure voice pitch

#modified slightly for my use
def measurePitch(voiceID, f0min=75, f0max=500, unit="Hertz"):
    sound = parselmouth.Sound(voiceID) # read the sound
    pitch = call(sound, "To Pitch", 0.0, f0min, f0max) #create a praat pitch object
    meanF0 = call(pitch, "Get mean", 0, 0, unit) # get mean pitch
    stdevF0 = call(pitch, "Get standard deviation", 0 ,0, unit) # get standard deviation
    harmonicity = call(sound, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr = call(harmonicity, "Get mean", 0, 0)
    return meanF0, stdevF0, hnr


