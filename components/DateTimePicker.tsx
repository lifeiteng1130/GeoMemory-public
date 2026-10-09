import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const YEARS = Array.from({ length: 30 }, (_, i) => 2010 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function Scroller({ data, selected, onSelect, width }: {
  data: number[];
  selected: number;
  onSelect: (v: number) => void;
  width: number;
}) {
  const initIndex = Math.max(0, data.indexOf(selected));
  return (
    <View style={[scrollerStyles.container, { width }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item)}
        initialScrollIndex={initIndex}
        getItemLayout={(_, index) => ({ length: 40, offset: 40 * index, index })}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[scrollerStyles.item, item === selected && scrollerStyles.itemActive]}
            onPress={() => onSelect(item)}
          >
            <Text style={[scrollerStyles.itemText, item === selected && scrollerStyles.itemTextActive]}>
              {String(item).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const scrollerStyles = StyleSheet.create({
  container: { height: 160 },
  item: {
    height: 40, justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 4, borderRadius: 8,
  },
  itemActive: { backgroundColor: 'rgba(0,122,255,0.2)' },
  itemText: { fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  itemTextActive: { fontSize: 17, color: '#fff', fontWeight: '700' },
});

export default function DateTimePicker({ value, onChange }: DateTimePickerProps) {
  const parts = value ? value.split(/[\s:-]/) : [];
  const currentYear = parseInt(parts[0]) || new Date().getFullYear();
  const currentMonth = parseInt(parts[1]) || (new Date().getMonth() + 1);
  const currentDay = parseInt(parts[2]) || new Date().getDate();
  const currentHour = parseInt(parts[3]) || 0;
  const currentMinute = parseInt(parts[4]) || 0;

  const [visible, setVisible] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [day, setDay] = useState(currentDay);
  const [hour, setHour] = useState(currentHour);
  const [minute, setMinute] = useState(currentMinute);

  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const safeDay = Math.min(day, daysInMonth);

  const confirm = () => {
    onChange(
      `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')} ` +
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    );
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity style={pickerStyles.trigger} onPress={() => setVisible(true)}>
        <Text style={pickerStyles.triggerText}>{value}</Text>
        <Text style={pickerStyles.triggerArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.modal}>
            <View style={pickerStyles.header}>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={pickerStyles.cancelBtn}>取消</Text>
              </TouchableOpacity>
              <Text style={pickerStyles.headerTitle}>选择时间</Text>
              <TouchableOpacity onPress={confirm}>
                <Text style={pickerStyles.confirmBtn}>确定</Text>
              </TouchableOpacity>
            </View>

            <View style={pickerStyles.columns}>
              <View style={pickerStyles.col}>
                <Text style={pickerStyles.label}>年</Text>
                <Scroller data={YEARS} selected={year} onSelect={setYear} width={60} />
              </View>
              <View style={pickerStyles.col}>
                <Text style={pickerStyles.label}>月</Text>
                <Scroller data={MONTHS} selected={month} onSelect={setMonth} width={50} />
              </View>
              <View style={pickerStyles.col}>
                <Text style={pickerStyles.label}>日</Text>
                <Scroller data={days} selected={safeDay} onSelect={setDay} width={50} />
              </View>
              <View style={pickerStyles.col}>
                <Text style={pickerStyles.label}>时</Text>
                <Scroller data={HOURS} selected={hour} onSelect={setHour} width={50} />
              </View>
              <View style={pickerStyles.col}>
                <Text style={pickerStyles.label}>分</Text>
                <Scroller data={MINUTES} selected={minute} onSelect={setMinute} width={50} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const pickerStyles = StyleSheet.create({
  trigger: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerText: { color: '#fff', fontSize: 16, letterSpacing: 1 },
  triggerArrow: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  overlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtn: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  confirmBtn: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  columns: {
    flexDirection: 'row', justifyContent: 'center', paddingVertical: 16, gap: 4,
  },
  col: { alignItems: 'center' },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 },
});
