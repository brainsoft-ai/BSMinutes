from djs.djs import DJS

# word list index
iS=0
iE=1
iT=2


WORD_OVERLAP_TIME_THRESHOLD = 0.95 # 

def check_time_overlap(s1, e1, s2, e2):
    if (s1-s2)*(e1-e2) > 0:
        total_length = max(e2-s1, e1-s2)
        overlap_length = max(0, min(e2-s1, e1-s2))
    else:
        total_length = max(e1-s1, e2-s2)
        overlap_length = min(e1-s1, e2-s2)

    if total_length == 0:
        return 0.0
    else:
        return overlap_length / total_length

def is_word_overlaping(word1, word2):
    if word1[iT] != word2[iT]:
        return False

    if check_time_overlap(word1[iS], word1[iE], word2[iS], word2[iE]) > WORD_OVERLAP_TIME_THRESHOLD:
        return True
    else:
        return False

def get_textlist(stt_segments):
    textlist = []
    for segment in stt_segments:
        textlist.append([segment['start'], segment['end'], segment['text']])
    return textlist

def get_wordlist(stt_segments):
    wordlist = []
    for segment in stt_segments:
        for word_data in segment['words']:
            wordlist.append(word_data)
    return wordlist

def get_overlapping_wordlist(wordlist1, wordlist2):
    overlapping_wordlist = []
    for word1 in wordlist1:
        for word2 in wordlist2:
            if word2[iS] > word1[iE] or word1[iS] > word2[iE]:
                continue
            if is_word_overlaping(word1, word2):
                overlapping_wordlist.append([word1, word2])

    return overlapping_wordlist

def remove_word_from_segments(word, segments):
    for segment in segments:
        if word in segment['words']:
            index = segment['words'].index(word)
            segment['words'].remove(word) 
            # remove this word from the text
            text_word_list = segment['text'].split()
            text_word_list.pop(index)
            segment['text'] = ' '.join(text_word_list)

    return segments

def remove_overlapping_words(overlapping_wordlist, stt_segments1, djs1, stt_segments2, djs2):
    t_stride = djs1.get_config().t_stride
    time_len1 = djs1.get_time_length()
    time_len2 = djs2.get_time_length()

    for wordpair in overlapping_wordlist:
        tslice1 = slice(wordpair[0][iS]//t_stride, wordpair[0][iE]//t_stride)
        if time_len1 < wordpair[0][iE]//t_stride:
            raise ValueError()
        tslice2 = slice(wordpair[1][iS]//t_stride, wordpair[1][iE]//t_stride)
        if time_len2 < wordpair[1][iE]//t_stride:
            raise ValueError()

        amp1 = djs1.get_amplitude_spectrogram(tslice=tslice1).sum().item()
        amp2 = djs2.get_amplitude_spectrogram(tslice=tslice2).sum().item()
        if amp1 > amp2:
            stt_segments2 = remove_word_from_segments(wordpair[1], stt_segments2)
        elif amp1 < amp2:
            stt_segments1 = remove_word_from_segments(wordpair[0], stt_segments1)
        else:
            pass
        print(stt_segments1)
        for segment in stt_segments1:
            if segment['text'] == "":
                stt_segments1.remove(segment)
        print(stt_segments1)

        for segment in stt_segments2:
            if segment['text'] == "":
                stt_segments2.remove(segment)

    return stt_segments1, stt_segments2

def remove_residual_words(stt_segments1, djs1, stt_segments2, djs2):
    textlist1 = get_textlist(stt_segments1)
    wordlist1 = get_wordlist(stt_segments1)
    textlist2 = get_textlist(stt_segments2)
    wordlist2 = get_wordlist(stt_segments2)

    overlapping_wordlist = get_overlapping_wordlist(wordlist1, wordlist2)
    return remove_overlapping_words(overlapping_wordlist, stt_segments1, djs1, stt_segments2, djs2)
