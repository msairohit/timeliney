import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Users, X, Plus } from 'lucide-react-native';
import { useEventStore } from '../../store/eventStore';

interface PeopleInputProps {
  people: string[];
  onPeopleChange: (people: string[]) => void;
}

export function PeopleInput({ people, onPeopleChange }: PeopleInputProps) {
  const [inputText, setInputText] = useState('');
  const allEvents = useEventStore(state => state.events);

  const suggestedPeople = useMemo(() => {
    const peopleSet = new Set<string>();
    allEvents.forEach(e => {
      if (e.people) {
        e.people.forEach(p => peopleSet.add(p));
      }
    });
    return Array.from(peopleSet).filter(p => !people.includes(p));
  }, [allEvents, people]);

  const addPerson = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !people.includes(trimmed)) {
      onPeopleChange([...people, trimmed]);
    }
    setInputText('');
  };

  const removePerson = (name: string) => {
    onPeopleChange(people.filter(p => p !== name));
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === ' ' || e.nativeEvent.key === 'Enter') {
      if (inputText.trim()) {
        addPerson(inputText);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Users size={20} color="#64748b" />
        <Text style={styles.title}>People</Text>
      </View>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add person (e.g. Mom, Ravi)..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => addPerson(inputText)}
          onKeyPress={handleKeyPress}
          returnKeyType="done"
        />
        <Pressable 
          style={styles.addButton} 
          onPress={() => addPerson(inputText)}
          disabled={!inputText.trim()}
        >
          <Plus size={20} color={inputText.trim() ? "#0f172a" : "#cbd5e1"} />
        </Pressable>
      </View>

      {people.length > 0 && (
        <View style={styles.chipsContainer}>
          {people.map((person, idx) => (
            <View key={idx} style={styles.chip}>
              <Text style={styles.chipText}>{person}</Text>
              <Pressable onPress={() => removePerson(person)} style={styles.chipRemove}>
                <X size={14} color="#64748b" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {suggestedPeople.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {suggestedPeople.map((person, idx) => (
              <Pressable 
                key={idx} 
                style={styles.suggestionChip}
                onPress={() => addPerson(person)}
              >
                <Plus size={12} color="#0f172a" style={styles.suggestionIcon} />
                <Text style={styles.suggestionText}>{person}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
  },
  addButton: {
    padding: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  chipRemove: {
    padding: 2,
  },
  suggestionsContainer: {
    marginTop: 4,
  },
  suggestionsTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  },
  suggestionsScroll: {
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  suggestionIcon: {
    marginRight: 2,
  },
  suggestionText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '500',
  },
});
