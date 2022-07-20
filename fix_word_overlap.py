from djs.djs import DJS
import json


def remove_punctuation(str_with_punctuation):
    punctuation= '''!()-[]{};:'"\, <>./?@#$%^&*_~'''
    new_str = ""
    new_str_index = 0
    index_matching_table = []
    for i, s in enumerate(str_with_punctuation):
        if s not in punctuation:
            new_str = new_str + s
            index_matching_table.append((new_str_index, i))
            new_str_index += 1
    return new_str, index_matching_table

class STT_Data_Error(Exception):
    pass

class STT_Data():

    class STT_base():
        def __init__(self):
            I_ST = 0
            I_ET = 0
            I_DATA = 2

    class STT_Data_base(STT_base):
        # checkout for indexedproperty from PyPI

        def __init__(self, data):
            if isinstance(data, list):
                self._data = data
            else:
                STT_Data_Error("stt data must be of list type")
        
        @property
        def start_time(self, idx=None):
            if idx == None:
                return self.data[0][I_ST]
            else:
                return self._data[idx][I_ST]
        
        @property
        def end_time(self, idx=None):
            if idx == None:
                return self.data[-1][I_ET]
            else:
                return self._data[idx][I_ET]

        def __getitem__(self, idx):
            return self._data[idx]

        def __setitem__(self, idx, value):
            self._data[idx] = value

        def __delitem__(self, idx):
            del self._data[idx]
        
        def append(self, data):
            self._data.append(data)



    # self._syllables = [] # syllable: [st, et, text, i_word, i_seg]
    # self._words = [] # word: [st, et, text, i_seg]
    # self._segment_texts = [] # text: [st, et, text, i_seg]
    # self._texts_original = [] # original text in json data
    # self._text_index_matching_tables = [] # (de-punctuated text index, original text index)

    def __init__(self, *, stt_segments=None, file_path=None):
        if stt_segments != None:
            self._stt_segments = stt_segments
        elif file_path != None:
            with open(file_path) as f:
                json_data = json.load(f)

            if 'segments' in json_data:
                self._stt_segments = json_data['segments']
            else:
                raise STT_Data_Error(f"segment data not found in the file: {file_path}")
        else:
            raise STT_Data_Error("stt_segments data or file path must be provided!")
        
        self._retrieve_data()

    def _retrieve_data(self):
        self._segment_texts = [] # original segment texts, keep this just for reference purpose for now
        self._words = []
        self._syllables = []
        if self._stt_segments != None:
            for i_seg, segment in enumerate(self._stt_segments):
                #seg_text, _ = remove_punctuation(segment['text'])
                self._segment_texts.append((segment['start'], segment['end'], segment['text'], i_seg))

                seg_word = []
                for i_word, word_data in enumerate(segment['words']):
                    stime = word_data[0]
                    etime = word_data[1]
                    word = word_data[2] # need to keep punctuation for text rebuild
                    seg_word.append((stime, etime, word))

                    # calculation of syllable time from word data is more accurate than from text data
                    _word, _ = remove_punctuation(word) # remove punctuation to get the pure phonemic syllables
                    syllable_interval = (etime-stime)/len(_word)
                    for i, syl in enumerate(_word):
                        st = int(stime + i * syllable_interval)
                        et = int(stime + (i+1) * syllable_interval)
                        self._syllables.append((st, et, syl, i_word, i_seg))
                self._words.append(seg_word)
        else:
            raise STT_Data_Error("There is no JSON data")

    def _get_word(i_word, i_seg):
        return self._words[i_seg][i_word]

    @property
    def json_data(self):
        _json_data = []

        if len(self._words) < 1:
            return _json_data

        for seg_words in self._words:
            seg_text = ""
            if len(seg_words) > 0: 
                for word in seg_words:
                    seg_text += " " + word[2]
                seg_text = seg_text[1:]
                stime = seg_words[0][0]
                etime = seg_words[-1][1]
                _json_data.append({'start':stime, 'end':etime, 'text':seg_text})
        else:
            pass

        return _json_data

    # @property
    # def texts(self):
    #     return self._segment_texts

    @property
    def full_text(self):
        _full_text = ""
        st = 0
        et = 0

        # for word in self._words:
        #     if word[2] != "" and word[2] != " ": # really??
        #         _full_text += " " + word[2]
        # _full_text = _full_text[1:]

        # st = self._words[0][0]
        # et = self._words[-1][1]

        if len(self._words) > 0:
            st = self._words[0][0][0]
            et = self._words[-1][-1][1]
            for seg_words in self._words:
                if len(seg_words) > 0: # check this out as there can be empty word list
                    for word in seg_words:
                        if word[2] != "" and word[2] != " ": # really??
                            _full_text += " " + word[2]

        if _full_text != "":
            _full_text = _full_text[1:]

        return st, et, _full_text

    def get_words(self):
        return self._words
    
    def get_syllables(self, texts_only=False):
        if texts_only:
            _syllables = ""
            for syl in self._syllables:
                _syllables += syl[2]
            return _syllables
        else:
            return self._syllables

    def _build_words_from_syllables(self):
        # reconstruct words from syllables
        seg_words = [] # word container for a specific segment
        words = [] # seg_words container
        current_seg = -1
        current_word = -1
        w_stime = 0
        w_etime = 0
        for syl in self._syllables:
            if current_seg < syl[4]: # at the start of the segment
                if current_seg != -1:
                    if current_word != -1: # there are strings for a word accumulated from the syllable
                        seg_words.append((w_stime, w_etime, word))
                        word = "" # redundant but keep it for clarity's sake
                        current_word = -1
                    words.append(seg_words)
                    print(seg_words)
                    seg_words = []
                    

                current_seg = syl[4]
                current_word = -1

            if current_word < syl[3]: # at the start of the word
                if current_word != -1: # there are strings for a word accumulated from the syllable
                    seg_words.append((w_stime, w_etime, word))
                    word = "" # redundant but keep it for clarity's sake
                    
                current_word = syl[3]
                word = syl[2]
                w_stime = syl[0]
                w_etime = syl[1]
            else:
                word += syl[2]
                w_etime = syl[1]

        seg_words.append((w_stime, w_etime, word))
        words.append(seg_words)

        for s1, s2 in zip(self._words, words):
            for w1, w2 in zip(s1, s2):
                pass

        self._words = words


    # removes strings from syllables and words
    def remove_text(self, index, str): # no punctuation text and its index
        # Retrieve word indices for use in word removal before removing texts from syllables
        i_syl_min = index
        i_syl_max = index + len(str) - 1

        index_set = set()
        s = ""
        for i in range(len(str)):
            s += self._syllables[index+i][2]
            i_word, i_seg = self._syllables[index+i][3:]
            index_set.add((i_seg, i_word))
        
        if str != s:
            STT_Data_Error("STT_Data.remove_text: string and its index not matching")

        index_set = sorted(index_set, key = lambda x: x[1], reverse=True)   # sort in reverse order for words
        index_set = sorted(index_set, key = lambda x: x[0])                 # sort in forward order for segments

        del self._syllables[index:index+len(str)]
        self._build_words_from_syllables()

    def __getitem__(self, idx):
            return self._syllables[idx]



# word list index
iS=0
iE=1
iT=2


WORD_OVERLAP_TIME_THRESHOLD = 0.45 # 
SUBSTR_OVERLAP_TIME_THRESHOLD = 0.45 # substrings are overlap if overlaping time is longer than this value
SYLLABLE_OVERLAP_THRESHOLD = 0.45 # number of overlaping syllables

def get_time_overlap_ratio(s1, e1, s2, e2):
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

# objects: [st, et, text] ~ syllable, word, text
def is_overlaping(obj1, obj2, min_overlap_time_ratio):
    if obj1[iT] != obj2[iT]:
        return False

    word_overlap_time_ratio = get_time_overlap_ratio(obj1[iS], obj1[iE], obj2[iS], obj2[iE])
    print(f"word overlap time percentage for {obj1[iT]}: {word_overlap_time_ratio}")
    if word_overlap_time_ratio > min_overlap_time_ratio:
        return True
    else:
        return False

def get_full_text(stt_segments):
    text = ""
    for segment in stt_segments:
        result, _ = remove_punctuation(segment['text'])
        text += result
    return text

def get_textlist(stt_segments):
    textlist = []
    for segment in stt_segments:
        result, _ = remove_punctuation(segment['text'])
        textlist.append([segment['start'], segment['end'], result])
    return textlist

def get_wordlist(stt_segments):
    wordlist = []
    for segment in stt_segments:
        for word_data in segment['words']:
            wordlist.append(word_data)
    return wordlist

def get_syllables(stt_segments):
    syllables = []
    for i_seg, segment in enumerate(stt_segments):
        # calculation of syllable time from word data is more accurate than from text data
        for word_data in segment['words']:
            stime = word_data[iS]
            etime = word_data[iE]
            word, _ = remove_punctuation(word_data[iT])
            syllable_interval = (etime-stime)/len(word)
            for i in range(len(word)):
                st = int(stime + i * syllable_interval)
                et = int(stime + (i+1) * syllable_interval)
                syllables.append([st, et, word[i], i_seg])
        # stime = segment['start']
        # etime = segment['end']
        # text, _ = remove_punctuation(segment['text'])
        # syllable_interval = (etime-stime)/len(text)
        # for i in range(len(text)):
        #     st = int(stime + i * syllable_interval)
        #     et = int(stime + (i+1) * syllable_interval)
        #     syllables.append([st, et, text[i], i_seg])

    return syllables

def get_overlaping_wordlist(wordlist1, wordlist2, min_overlap_time_ratio=0):
    overlaping_wordlist = []
    for word1 in wordlist1:
        for word2 in wordlist2:
            if word2[iS] > word1[iE] or word1[iS] > word2[iE]:
                continue
            if is_overlaping(word1, word2, min_overlap_time_ratio):
                overlaping_wordlist.append([word1, word2])

    return overlaping_wordlist

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

def remove_overlaping_words(overlaping_wordlist, stt_segments1, djs1, stt_segments2, djs2):
    t_stride = djs1.get_config().t_stride
    time_len1 = djs1.time_length
    time_len2 = djs2.time_length

    for wordpair in overlaping_wordlist:
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

        for segment in stt_segments1:
            if segment['text'] == "":
                stt_segments1.remove(segment)

        for segment in stt_segments2:
            if segment['text'] == "":
                stt_segments2.remove(segment)

    return stt_segments1, stt_segments2

def remove_residual_words(stt_segments1, djs1, stt_segments2, djs2):
    #textlist1 = get_textlist(stt_segments1)
    wordlist1 = get_wordlist(stt_segments1)
    #textlist2 = get_textlist(stt_segments2)
    wordlist2 = get_wordlist(stt_segments2)

    overlaping_wordlist = get_overlaping_wordlist(wordlist1, wordlist2)
    stt_segments1, stt_segments2 = remove_overlaping_words(overlaping_wordlist, stt_segments1, djs1, stt_segments2, djs2)
    return stt_segments1, stt_segments2


####################################################################################################################################
## sentence based removal
####################################################################################################################################

def get_syllable_time_interval(syllables, start, end):
    return syllables[end][iE] - syllables[start][iS]

MINIMUM_MATCH_LEN = 2
def get_substring_matches(stt_data1, stt_data2):

    syllables1  = stt_data1.get_syllables()
    str1 = ""
    for syl in syllables1:
        str1 += syl[2]

    syllables2  = stt_data2.get_syllables()
    str2 = ""
    for syl in syllables2:
        str2 += syl[2]

    matches = []
    for i in range(len(str1), 0, -1): #i: length of substring
        if i < MINIMUM_MATCH_LEN: # no need to compare syllables of length (MINIMUM_MATCH_LEN-1)
            break
        for j in range(len(str1)): # j: position in str1
            if i + j > len(str1):
                break
            substr = str1[j:j+i]
            for k in range(len(str2)): # k: position in str2
                if str2.startswith(substr, k):
                    match_already_found = False
                    for match in matches:
                        if match[1].startswith(substr, j-match[0]) and k-match[2] == j-match[0]: # is submatch
                            match_already_found = True
                    if not match_already_found:
                        # check if substring time intervals match or not
                        strlen = len(substr)
                        st1 = syllables1[j][iS]
                        et1 = syllables1[j+strlen-1][iE]
                        st2 = syllables2[k][iS]
                        et2 = syllables2[k+strlen-1][iE]
                        time_overlap = get_time_overlap_ratio(st1, et1, st2, et2)
                        if time_overlap > 0.0: # would it be necessary to apply more strict criteria than 0.0?
                            matches.append((j, substr, k, substr))
                    
    return matches

def get_overlaping_time_interval(textlist1, textlist2):
    # oti_list = []
    # for text1 in textlist1:
    #     for text2 in textlist2:
    #         pass
    # return oti_list
    pass

def get_overlaping_texts(stt_data1, stt_data2):
    # find overlaping texts containing one or more consecutive elements in matches
    # overlaping_text : list of indices and substrings of form (i1, substr1, i2, substr2)
    # overlaping_texts : list of overlaping_text

    matches = get_substring_matches(stt_data1, stt_data2) # matches = [(i1, i2, str), ...]

    # test for match continuity
    overlaping_texts = []
    for match in matches:
        # overlaping_text = (i1, substr1, i2, substr2)
        
        overlaping_text = (match[0], match[1], match[2], match[3]) # for a simple test
        overlaping_texts.append(overlaping_text)

    return overlaping_texts

def get_the_weaker_one(overlaping_text, stt_data1, djs1, stt_data2, djs2):
    i1, str1, i2, str2 = overlaping_text
    stime1 = stt_data1[i1][0]
    etime1 = stt_data1[i1+len(str1)-1][1]
    stime2 = stt_data2[i2][0]
    etime2 = stt_data2[i2+len(str2)-1][1]

    djs_str1 = djs1.get_amplitude_spectrogram_for_time_period(stime1, etime1)
    djs_str2 = djs2.get_amplitude_spectrogram_for_time_period(stime2, etime2)

    avg_str1 = djs_str1.mean().item()
    avg_str2 = djs_str2.mean().item()

    if avg_str1 > avg_str2:
        return None, None, i2, str2
    elif avg_str1 < avg_str2:
        return i1, str1, None, None
    else:
        return None, None, None, None

def remove_overlaping_texts(overlaping_texts, stt_data1, djs1, stt_data2, djs2):

    overlaping_texts.reverse()
    for overlaping_text in overlaping_texts: # (i1, substr1, i2, substr2)
        # which one to remove, 1 or 2?
        i1, str1, i2, str2 = get_the_weaker_one(overlaping_text, stt_data1, djs1, stt_data2, djs2)
        if i1 != None:
            stt_data1.remove_text(i1, str1)
        elif i2 != None:
            stt_data2.remove_text(i2, str2)
        else:
            STT_Data_Error(f"can't decide which one to remove:({i1}, {str1}) or ({i2}, {str2})")

    return stt_data1, stt_data2

def remove_residual_texts(stt_segments1, djs1, stt_segments2, djs2):
    stt_data1 = STT_Data(stt_segments=stt_segments1)
    stt_data2 = STT_Data(stt_segments=stt_segments2)
    
    overlaping_texts = get_overlaping_texts(stt_data1, stt_data2)

    stt_data1, stt_data2 = remove_overlaping_texts(overlaping_texts, stt_data1, djs1, stt_data2, djs2)

    return stt_data1.json_data, stt_data2.json_data
