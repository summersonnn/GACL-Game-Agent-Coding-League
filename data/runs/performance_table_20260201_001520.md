# Benchmark Run Questions

This run focuses on **reasoning** and **math** capabilities.

## Questions

### A3: Overfitting test 

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <div class="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
        <span class="text-xl mr-3">📂</span>
        <div>
            <div class="text-xs text-blue-500 font-semibold uppercase tracking-wider">Category</div>
            <div class="font-medium text-blue-900">Basic Mix</div>
        </div>
    </div>
    <div class="flex items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <span class="text-xl mr-3">⚖️</span>
        <div>
            <div class="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Evaluation</div>
            <div class="font-medium text-indigo-900">Judge LLM</div>
        </div>
    </div>
     <div class="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
        <span class="text-xl mr-3">⭐</span>
        <div>
            <div class="text-xs text-amber-500 font-semibold uppercase tracking-wider">Points</div>
            <div class="font-medium text-amber-900">2</div>
        </div>
    </div>
</div>

<p class="text-gray-600 leading-relaxed mb-8">
    This benchmark evaluates whether the model overfits its training data to the extent that it fails to recognize even minor variations in a question.
</p>

<div class="mb-8">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">💬</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Question Prompt</h4>
    </div>
    <div class="bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg font-mono text-sm leading-relaxed border border-gray-700 relative overflow-hidden group">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl transform rotate-12 group-hover:scale-110 transition-transform duration-500">⌨️</div>
        Every day a man takes the elevator all the way down, but coming home, takes it to the top floor. Why?
    </div>
</div>

<div class="mb-12">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">✅</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Ground Truth / Judging Criteria</h4>
    </div>
    <div class="bg-green-50 text-green-900 p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl">✓</div>
        <p class="font-medium mb-1">Answer:</p>
        <p class="mb-0">Because he lives at the top floor. It has nothing to do with his height. If the model mentions anything about height, mark it as incorrect.</p>
    </div>
</div>

<hr class="my-12 border-gray-200">

### A9: Longest Word

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <div class="flex items-center p-3 bg-purple-50 rounded-lg border border-purple-100">
        <span class="text-xl mr-3">🌍</span>
        <div>
            <div class="text-xs text-purple-500 font-semibold uppercase tracking-wider">Category</div>
            <div class="font-medium text-purple-900">General Knowledge</div>
        </div>
    </div>
    <div class="flex items-center p-3 bg-cyan-50 rounded-lg border border-cyan-100">
        <span class="text-xl mr-3">🤖</span>
        <div>
            <div class="text-xs text-cyan-500 font-semibold uppercase tracking-wider">Evaluation</div>
            <div class="font-medium text-cyan-900">Verifier Code</div>
        </div>
    </div>
     <div class="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
        <span class="text-xl mr-3">⭐</span>
        <div>
            <div class="text-xs text-amber-500 font-semibold uppercase tracking-wider">Points</div>
            <div class="font-medium text-amber-900">3</div>
        </div>
    </div>
</div>

<div class="mb-8">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">💬</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Question Prompt</h4>
    </div>
    <div class="bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg font-mono text-sm leading-relaxed border border-gray-700 relative overflow-hidden group whitespace-pre-wrap">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl transform rotate-12 group-hover:scale-110 transition-transform duration-500">⌨️</div>
Find the longest English word you can that meets these criteria:
Contains exactly one "o", one "a", and one "e"
Has at least twice as many consonants as vowels and one of the vowels is either the first or the last letter of the word.
Don't use plural! Plural forms are prohibited.
Please write your final answer in the form of \boxed{answer}. Don't use any latex format inside the answer box.
    </div>
</div>

<div class="mb-12">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">✅</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Scoring Criteria</h4>
    </div>
    <div class="bg-green-50 text-green-900 p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl">✓</div>
        <p class="font-medium mb-2">Max Points: 3</p>
        <ul class="list-disc list-inside space-y-1">
            <li>1 point if all rules are satisfied</li>
            <li>+1 point if the word is longer than 8 characters (9+)</li>
            <li>+1 point if the word is longer than 10 characters (11+)</li>
        </ul>
    </div>
</div>

<hr class="my-12 border-gray-200">

### A17: Mate in One

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <div class="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
        <span class="text-xl mr-3">♟️</span>
        <div>
            <div class="text-xs text-orange-500 font-semibold uppercase tracking-wider">Category</div>
            <div class="font-medium text-orange-900">Reasoning</div>
        </div>
    </div>
    <div class="flex items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <span class="text-xl mr-3">⚖️</span>
        <div>
            <div class="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Evaluation</div>
            <div class="font-medium text-indigo-900">Judge LLM</div>
        </div>
    </div>
     <div class="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
        <span class="text-xl mr-3">⭐</span>
        <div>
            <div class="text-xs text-amber-500 font-semibold uppercase tracking-wider">Points</div>
            <div class="font-medium text-amber-900">3</div>
        </div>
    </div>
</div>

<div class="mb-8">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">💬</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Question Prompt</h4>
    </div>
    <div class="bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg font-mono text-sm leading-relaxed border border-gray-700 relative overflow-hidden group whitespace-pre-wrap">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl transform rotate-12 group-hover:scale-110 transition-transform duration-500">⌨️</div>
White has a king on e3, rooks on a7 and d1, a knight on d8, and pawns on d7 and f7. Black has a king on e7, a rook on f8, a knight on e8, and a pawn on e6. White to move and mate in one.
    </div>
</div>

<div class="mb-12">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">✅</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Ground Truth</h4>
    </div>
    <div class="bg-green-50 text-green-900 p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl">✓</div>
        <p class="font-medium mb-1">Answer:</p>
        <p class="mb-0">dxe8=N+ there is no other move. The only move is dxe8=N+ which mates in one. dxe8=Q+ or any other move is not checkmate!</p>
    </div>
</div>

<hr class="my-12 border-gray-200">

### A20: Find The Rule

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <div class="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
        <span class="text-xl mr-3">🧠</span>
        <div>
            <div class="text-xs text-orange-500 font-semibold uppercase tracking-wider">Category</div>
            <div class="font-medium text-orange-900">Reasoning</div>
        </div>
    </div>
    <div class="flex items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <span class="text-xl mr-3">⚖️</span>
        <div>
            <div class="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Evaluation</div>
            <div class="font-medium text-indigo-900">Judge LLM</div>
        </div>
    </div>
     <div class="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
        <span class="text-xl mr-3">⭐</span>
        <div>
            <div class="text-xs text-amber-500 font-semibold uppercase tracking-wider">Points</div>
            <div class="font-medium text-amber-900">2</div>
        </div>
    </div>
</div>

<div class="mb-8">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">💬</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Question Prompt</h4>
    </div>
    <div class="bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg font-mono text-sm leading-relaxed border border-gray-700 relative overflow-hidden group whitespace-pre-wrap">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl transform rotate-12 group-hover:scale-110 transition-transform duration-500">⌨️</div>
Find the rule:
- almost? Yes
- biopsy? Yes
- dead? No
- garden? No
- adopt? Yes
- empty? Yes
- find? No
- begins? Yes
- ghosty? Yes
- window? No
- flourish? No
    </div>
</div>

<div class="mb-12">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">✅</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Ground Truth</h4>
    </div>
    <div class="bg-green-50 text-green-900 p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl">✓</div>
        <p class="font-medium mb-1">Answer:</p>
        <p class="mb-0">letters ordered alphabetically. Do not accept any other answer.</p>
    </div>
</div>

<hr class="my-12 border-gray-200">

### A26.1

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <div class="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
        <span class="text-xl mr-3">🧠</span>
        <div>
            <div class="text-xs text-orange-500 font-semibold uppercase tracking-wider">Category</div>
            <div class="font-medium text-orange-900">Reasoning</div>
        </div>
    </div>
    <div class="flex items-center p-3 bg-indigo-50 rounded-lg border border-indigo-100">
        <span class="text-xl mr-3">⚖️</span>
        <div>
            <div class="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Evaluation</div>
            <div class="font-medium text-indigo-900">Judge LLM</div>
        </div>
    </div>
     <div class="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
        <span class="text-xl mr-3">⭐</span>
        <div>
            <div class="text-xs text-amber-500 font-semibold uppercase tracking-wider">Points</div>
            <div class="font-medium text-amber-900">1</div>
        </div>
    </div>
</div>

<div class="mb-8">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">💬</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Question Prompt</h4>
    </div>
    <div class="bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg font-mono text-sm leading-relaxed border border-gray-700 relative overflow-hidden group whitespace-pre-wrap">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl transform rotate-12 group-hover:scale-110 transition-transform duration-500">⌨️</div>
This is a puzzle game concept where players guess a common word pairing or phrase (collocation) based on a visual clue or tip.

Here are the examples in a simplified format:

    Clue: The word "School" is positioned high up inside a black box. Answer: High School

    Clue: The word "Decision" is written with a noticeable gap, separating "Deci" and "sion." Answer: Split decision

    Clue: Two vertical lines of words appear as "TAHW" and "MUST." Answer: What goes up must come down

Now solve this: The word "TROUBLE" is inside a black square, but the letters 'R' and 'U' are highlighted or colored differently from the other letters.
    </div>
</div>

<div class="mb-12">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">✅</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Ground Truth</h4>
    </div>
    <div class="bg-green-50 text-green-900 p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl">✓</div>
        <p class="font-medium mb-1">Answer:</p>
        <p class="mb-0">"Are you in trouble?" Do not accept any other answer.</p>
    </div>
</div>

<hr class="my-12 border-gray-200">

### A27: Number of words in response

<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <div class="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-100">
        <span class="text-xl mr-3">🧠</span>
        <div>
            <div class="text-xs text-orange-500 font-semibold uppercase tracking-wider">Category</div>
            <div class="font-medium text-orange-900">Reasoning</div>
        </div>
    </div>
    <div class="flex items-center p-3 bg-cyan-50 rounded-lg border border-cyan-100">
        <span class="text-xl mr-3">🤖</span>
        <div>
            <div class="text-xs text-cyan-500 font-semibold uppercase tracking-wider">Evaluation</div>
            <div class="font-medium text-cyan-900">Verifier Code</div>
        </div>
    </div>
     <div class="flex items-center p-3 bg-amber-50 rounded-lg border border-amber-100">
        <span class="text-xl mr-3">⭐</span>
        <div>
            <div class="text-xs text-amber-500 font-semibold uppercase tracking-wider">Points</div>
            <div class="font-medium text-amber-900">2</div>
        </div>
    </div>
</div>

<div class="mb-8">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">💬</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Question Prompt</h4>
    </div>
    <div class="bg-gray-800 text-gray-100 p-6 rounded-xl shadow-lg font-mono text-sm leading-relaxed border border-gray-700 relative overflow-hidden group whitespace-pre-wrap">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl transform rotate-12 group-hover:scale-110 transition-transform duration-500">⌨️</div>
How many words in your response to this message? End your message with the number. Do not put any word after the number. You can phrase it however you like and choose any words you wish.
Example: The number of words in this message can be found at the end of this sentence [some number here]
Do not count the number at the end of your response as a word.
    </div>
</div>

<div class="mb-12">
    <div class="flex items-center mb-3">
         <span class="text-xl mr-2">✅</span>
         <h4 class="text-gray-900 font-bold m-0 text-lg">Scoring Criteria</h4>
    </div>
    <div class="bg-green-50 text-green-900 p-6 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
        <div class="absolute top-0 right-0 p-3 opacity-10 text-6xl">✓</div>
        <p class="font-medium mb-1">Max Points: 2</p>
        <p class="mb-0">Verified programmatically. The response must end with the correct count of words preceding it.</p>
    </div>
</div>

